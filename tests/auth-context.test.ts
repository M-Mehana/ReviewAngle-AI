import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const mock = vi.hoisted(() => ({ getUser: vi.fn(), rpc: vi.fn() }));
vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({ auth: { getUser: mock.getUser }, rpc: mock.rpc }),
}));
import { context } from "../src/lib/server/context";
beforeEach(() => {
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("LOCAL_STAGING_MODE", "false");
  vi.stubEnv("DEMO_MODE", "true");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://test.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "public-test-value");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "private-test-value");
  vi.stubEnv("OPENAI_API_KEY", "private-test-value");
  mock.getUser.mockReset();
  mock.rpc.mockReset();
});
afterEach(() => vi.unstubAllEnvs());
function request(token?: string) {
  return new NextRequest("http://localhost:3000/api/projects", {
    headers: token ? { authorization: `Bearer ${token}` } : {},
  });
}
it("production never grants demo access on localhost and requires a bearer session", async () => {
  await expect(context(request())).rejects.toMatchObject({ status: 401 });
  expect(mock.getUser).not.toHaveBeenCalled();
});
it("rejects an invalid or expired bearer token after server-side verification", async () => {
  mock.getUser.mockResolvedValue({
    data: { user: null },
    error: new Error("test session rejection"),
  });
  await expect(context(request("invalid-test-token"))).rejects.toMatchObject({
    status: 401,
  });
  expect(mock.rpc).not.toHaveBeenCalled();
});
it("uses the verified Supabase user and database without a local-mode bypass", async () => {
  mock.getUser.mockResolvedValue({
    data: { user: { id: "verified-user" } },
    error: null,
  });
  mock.rpc.mockResolvedValue({ data: true, error: null });
  const result = await context(request("test-session-token"));
  expect(result.userId).toBe("verified-user");
  expect(result.demo).toBe(false);
  expect(result.localStaging).not.toBe(true);
  expect(result.db).toBeDefined();
  expect(mock.rpc).toHaveBeenCalledWith("reserve_request", {
    owner_id: "verified-user",
  });
});
it("fails closed when the production request allowance cannot be verified", async () => {
  mock.getUser.mockResolvedValue({
    data: { user: { id: "verified-user" } },
    error: null,
  });
  mock.rpc.mockResolvedValue({
    data: null,
    error: new Error("test database failure"),
  });
  await expect(context(request("test-session-token"))).rejects.toMatchObject({
    status: 503,
  });
});
