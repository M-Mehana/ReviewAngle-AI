import { NextRequest } from "next/server";
import { context, failure } from "@/lib/server/context";
import { step } from "@/lib/server/service";
export const runtime = "nodejs";
export const maxDuration = 300;
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    return Response.json({
      project: await step(await context(req), (await params).id),
    });
  } catch (e) {
    return failure(e);
  }
}
