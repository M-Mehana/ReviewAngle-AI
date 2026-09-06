import dns from "node:dns/promises";
import http from "node:http";
import https from "node:https";
import ipaddr from "ipaddr.js";
export function publicIP(address: string) {
  try {
    const ip = ipaddr.parse(address);
    return (
      ip.range() === "unicast" &&
      !(ip.kind() === "ipv6" && (ip as ipaddr.IPv6).isIPv4MappedAddress())
    );
  } catch {
    return false;
  }
}
export function validateURL(input: string) {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    throw new Error("Enter a valid public page URL.");
  }
  const host = url.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (
    !["https:", "http:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.port ||
    host === "localhost" ||
    /\.(localhost|local|internal|test|invalid)$/.test(host) ||
    (!host.includes(".") && !host.includes(":")) ||
    (ipaddr.isValid(host) && !publicIP(host))
  )
    throw new Error(
      "Only public HTTP or HTTPS pages on standard ports are supported. Paste or upload reviews instead.",
    );
  return url;
}
export async function resolvePublic(url: URL) {
  const host = url.hostname.replace(/^\[|\]$/g, "");
  const answers = await dns.lookup(host, { all: true, verbatim: true });
  if (!answers.length || answers.some((a) => !publicIP(a.address)))
    throw new Error(
      "This address does not resolve exclusively to a public network.",
    );
  return answers[0];
}
export async function fetchPublic(
  input: string,
  policy: (url: URL) => void,
  options = { maxBytes: 2_000_000, timeout: 12000, redirects: 3 },
) {
  const deadline = Date.now() + options.timeout;
  let current = input;
  for (let redirect = 0; redirect <= options.redirects; redirect++) {
    const url = validateURL(current);
    policy(url);
    const remaining = deadline - Date.now();
    if (remaining <= 0)
      throw new Error(
        "The source took too long to respond. Try paste or CSV import.",
      );
    const ip = await Promise.race([
      resolvePublic(url),
      new Promise<never>((_, reject) => {
        const t = setTimeout(
          () => reject(new Error("Source lookup timed out.")),
          remaining,
        );
        t.unref();
      }),
    ]);
    const response = await new Promise<{
      status: number;
      location?: string;
      type: string;
      body: string;
    }>((resolve, reject) => {
      const request = (url.protocol === "https:" ? https : http).get(
        url,
        {
          family: ip.family,
          headers: {
            "User-Agent": "ReviewAngleAI/1.0 (public review import)",
            Accept: "text/html,text/plain",
            "Accept-Encoding": "identity",
          },
          lookup: (_hostname, _options, cb) => cb(null, ip.address, ip.family),
        },
        (res) => {
          const chunks: Buffer[] = [];
          let size = 0;
          if (Number(res.headers["content-length"] || 0) > options.maxBytes) {
            request.destroy(
              new Error("This page is too large. Use a file import."),
            );
            return;
          }
          if (
            res.headers["content-encoding"] &&
            res.headers["content-encoding"] !== "identity"
          ) {
            request.destroy(
              new Error(
                "Compressed source response is not supported. Use a file import.",
              ),
            );
            return;
          }
          res.on("data", (chunk: Buffer) => {
            size += chunk.length;
            if (size > options.maxBytes)
              request.destroy(
                new Error("This page is too large. Use a file import."),
              );
            else chunks.push(chunk);
          });
          res.on("error", reject);
          res.on("end", () =>
            resolve({
              status: res.statusCode || 500,
              location: res.headers.location,
              type: res.headers["content-type"] || "",
              body: Buffer.concat(chunks).toString("utf8"),
            }),
          );
        },
      );
      const timer = setTimeout(
        () =>
          request.destroy(
            new Error("The source timed out. Paste or upload reviews instead."),
          ),
        Math.max(1, deadline - Date.now()),
      );
      request.on("close", () => clearTimeout(timer));
      request.on("error", reject);
    });
    if (
      [301, 302, 303, 307, 308].includes(response.status) &&
      response.location
    ) {
      current = new URL(response.location, url).href;
      continue;
    }
    if (
      response.status === 401 ||
      response.status === 403 ||
      response.status === 429 ||
      /captcha|cf-chl-|verify you are human/i.test(response.body)
    )
      throw new Error(
        "This source requires access verification. We cannot import it automatically; paste or upload reviews instead.",
      );
    if (response.status >= 400)
      throw new Error(
        "The public page is unavailable. Paste or upload reviews instead.",
      );
    return { ...response, url: url.href };
  }
  throw new Error(
    "Too many redirects. Use the final public page URL or import a file.",
  );
}
