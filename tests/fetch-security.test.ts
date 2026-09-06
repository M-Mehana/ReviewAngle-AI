import { EventEmitter } from "node:events";
import dns from "node:dns/promises";
import https from "node:https";
import type { ClientRequest, IncomingMessage, RequestOptions } from "node:http";
import { afterEach, expect, it, vi } from "vitest";
import { fetchPublic } from "../src/lib/connectors/security";
afterEach(() => vi.restoreAllMocks());
function transport(reply: {
  status?: number;
  location?: string;
  body?: string;
  stall?: boolean;
}) {
  vi.spyOn(dns, "lookup").mockResolvedValue([
    { address: "8.8.8.8", family: 4 },
  ] as never);
  return vi.spyOn(https, "get").mockImplementation(((
    url: URL,
    options: RequestOptions,
    cb: (res: IncomingMessage) => void,
  ) => {
    const request = new EventEmitter() as ClientRequest;
    request.destroy = ((error?: Error) => {
      if (error) request.emit("error", error);
      request.emit("close");
      return request;
    }) as typeof request.destroy;
    queueMicrotask(() => {
      if (reply.stall) return;
      const res = new EventEmitter() as IncomingMessage;
      res.statusCode = reply.status || 200;
      res.headers = {
        "content-type": "text/html",
        ...(reply.location ? { location: reply.location } : {}),
      };
      cb(res);
      res.emit("data", Buffer.from(reply.body || "<html>public</html>"));
      res.emit("end");
      request.emit("close");
    });
    return request;
  }) as typeof https.get);
}
it("rejects any private DNS answer even alongside a public answer", async () => {
  vi.spyOn(dns, "lookup").mockResolvedValue([
    { address: "8.8.8.8", family: 4 },
    { address: "127.0.0.1", family: 4 },
  ] as never);
  await expect(
    fetchPublic("https://shop.example.com", () => {}),
  ).rejects.toThrow("public network");
});
it("pins the TCP lookup to the validated address", async () => {
  const spy = transport({});
  await fetchPublic("https://shop.example.com", () => {});
  const options = spy.mock.calls[0][1] as RequestOptions;
  const callback = vi.fn();
  (options.lookup as Function)("shop.example.com", {}, callback);
  expect(callback).toHaveBeenCalledWith(null, "8.8.8.8", 4);
  expect(options.family).toBe(4);
});
it("revalidates a redirect before connecting to its destination", async () => {
  const spy = transport({
    status: 302,
    location: "http://169.254.169.254/latest/meta-data",
  });
  await expect(
    fetchPublic("https://shop.example.com", () => {}),
  ).rejects.toThrow("public HTTP");
  expect(spy).toHaveBeenCalledTimes(1);
});
it("caps response bytes and enforces a total timeout", async () => {
  transport({ body: "x".repeat(500) });
  await expect(
    fetchPublic("https://shop.example.com", () => {}, {
      maxBytes: 100,
      timeout: 1000,
      redirects: 1,
    }),
  ).rejects.toThrow("too large");
  vi.restoreAllMocks();
  transport({ stall: true });
  await expect(
    fetchPublic("https://shop.example.com", () => {}, {
      maxBytes: 100,
      timeout: 20,
      redirects: 1,
    }),
  ).rejects.toThrow("timed out");
});
it("limits redirects and refuses access challenges", async () => {
  const spy = transport({ status: 302, location: "/again" });
  await expect(
    fetchPublic("https://shop.example.com", () => {}, {
      maxBytes: 100,
      timeout: 1000,
      redirects: 2,
    }),
  ).rejects.toThrow("Too many redirects");
  expect(spy).toHaveBeenCalledTimes(3);
  vi.restoreAllMocks();
  transport({ status: 403, body: "CAPTCHA" });
  await expect(
    fetchPublic("https://shop.example.com", () => {}),
  ).rejects.toThrow("access verification");
});
