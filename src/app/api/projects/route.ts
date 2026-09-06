import { NextRequest } from "next/server";
import { body, context, failure } from "@/lib/server/context";
import { listProjects } from "@/lib/server/store";
import { createProject } from "@/lib/server/service";
export const runtime = "nodejs";
export async function GET(req: NextRequest) {
  try {
    return Response.json(
      { projects: await listProjects(await context(req)) },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return failure(e);
  }
}
export async function POST(req: NextRequest) {
  try {
    const c = await context(req);
    return Response.json(
      { project: await createProject(c, await body(req)) },
      { status: 201 },
    );
  } catch (e) {
    return failure(e);
  }
}
