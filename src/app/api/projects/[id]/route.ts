import { NextRequest } from "next/server";
import { body, context, failure } from "@/lib/server/context";
import { getProject } from "@/lib/server/store";
import { action } from "@/lib/server/service";
export const runtime = "nodejs";
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    return Response.json(
      { project: await getProject(await context(req), (await params).id) },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return failure(e);
  }
}
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const c = await context(req);
    return Response.json(
      await action(c, (await params).id, await body(req, 10000)),
    );
  } catch (e) {
    return failure(e);
  }
}
