import { NextRequest } from "next/server";
import { z } from "zod";
import { AppError, body, context, failure } from "@/lib/server/context";
import { reserve } from "@/lib/server/store";
import { importURL } from "@/lib/connectors";
export const runtime = "nodejs";
export async function POST(req: NextRequest) {
  try {
    const c = await context(req);
    if (c.localStaging)
      throw new AppError(
        "Use Paste, CSV or TXT in local staging. URL imports require an authenticated account.",
      );
    if (c.demo)
      throw new AppError(
        "Public URL imports require a configured account. Try the synthetic examples or paste/CSV preview.",
      );
    const { url } = z
      .object({ url: z.string().max(2000) })
      .parse(await body(req, 5000));
    await reserve(c, crypto.randomUUID(), "url", 1);
    try {
      return Response.json(await importURL(url));
    } catch (e) {
      throw new AppError(
        e instanceof Error
          ? e.message
          : "Unable to import this source. Use paste or CSV.",
      );
    }
  } catch (e) {
    return failure(e);
  }
}
