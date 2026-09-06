import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { NextRequest } from "next/server";
import { localStagingAllowed } from "./local-staging";
export type Context = {
  userId: string;
  demo: boolean;
  localStaging?: boolean;
  db?: SupabaseClient;
};
export class AppError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
export function configured() {
  return !!(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
    process.env.SUPABASE_SERVICE_ROLE_KEY &&
    process.env.OPENAI_API_KEY
  );
}
export async function context(req: NextRequest): Promise<Context> {
  if (process.env.LOCAL_STAGING_MODE === "true") {
    let allowed = false;
    try {
      allowed = localStagingAllowed(req.headers, req.nextUrl);
    } catch {
      throw new AppError(
        "Local staging requires non-production mode and DEMO_MODE=false.",
        503,
      );
    }
    if (!allowed)
      throw new AppError(
        "Local staging requires a direct same-origin localhost or 127.0.0.1 request.",
        403,
      );
    if (!process.env.OPENAI_API_KEY)
      throw new AppError(
        "Local staging requires OPENAI_API_KEY in the server environment.",
        503,
      );
    return {
      userId: "00000000-0000-4000-8000-000000000002",
      demo: false,
      localStaging: true,
    };
  }
  if (req.method !== "GET") {
    const origin = req.headers.get("origin");
    const localOrigins =
      process.env.NODE_ENV !== "production"
        ? ["http://localhost:3000", "http://127.0.0.1:3000"]
        : [];
    if (
      origin &&
      origin !== req.nextUrl.origin &&
      origin !== process.env.APP_ORIGIN &&
      !localOrigins.includes(origin)
    )
      throw new AppError("Request origin is not allowed.", 403);
  }
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(
    req.nextUrl.hostname,
  );
  if (
    process.env.DEMO_MODE === "true" &&
    process.env.NODE_ENV !== "production" &&
    local
  )
    return { userId: "00000000-0000-4000-8000-000000000001", demo: true };
  if (!configured())
    throw new AppError(
      "Connect Supabase and OpenAI in the server environment to start your workspace. For local synthetic examples, enable demo mode.",
      503,
    );
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) throw new AppError("Please sign in to continue.", 401);
  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const { data, error } = await db.auth.getUser(token);
  if (error || !data.user)
    throw new AppError("Your session expired. Please sign in again.", 401);
  const rate = await db.rpc("reserve_request", { owner_id: data.user.id });
  if (rate.error)
    throw new AppError(
      "Unable to check your request allowance. Check the database migration and retry.",
      503,
    );
  if (!rate.data)
    throw new AppError(
      "Too many requests. Please wait a minute and resume.",
      429,
    );
  return { userId: data.user.id, demo: false, db };
}
export async function body(
  req: NextRequest,
  maxBytes = 2_000_000,
): Promise<unknown> {
  if (Number(req.headers.get("content-length") || 0) > maxBytes)
    throw new AppError(
      "This upload is too large. Split it into smaller files.",
      413,
    );
  if (!req.body) throw new AppError("Request body is missing.");
  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > maxBytes) {
      await reader.cancel();
      throw new AppError(
        "This upload is too large. Split it into smaller files.",
        413,
      );
    }
    chunks.push(value);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new AppError("Invalid request data.");
  }
}
export function failure(error: unknown) {
  if (error instanceof AppError)
    return Response.json({ error: error.message }, { status: error.status });
  if (error instanceof Error && error.name === "ZodError")
    return Response.json(
      {
        error:
          "Some fields are missing or invalid. Review your input and try again.",
      },
      { status: 400 },
    );
  return Response.json(
    {
      error:
        "This request could not be completed. Please retry. If it continues, check the server and service configuration.",
    },
    { status: 500 },
  );
}
export function limit(name: string, fallback: number) {
  const n = Number(process.env[name]);
  return Number.isInteger(n) && n > 0 ? n : fallback;
}
