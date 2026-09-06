import "server-only";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Context } from "./context";
import { AppError, limit } from "./context";
import type { Project } from "../analysis/schema";
const folder = path.join(process.cwd(), ".local");
const file = (id: string) => path.join(folder, `${id}.json`);
const validId = (id: string) => {
  if (!/^[0-9a-f-]{36}$/i.test(id))
    throw new AppError("Project not found.", 404);
};
export async function listProjects(c: Context): Promise<Project[]> {
  if (c.demo) {
    const { readdir } = await import("node:fs/promises");
    await mkdir(folder, { recursive: true });
    const names = (await readdir(folder)).filter((n) => n.endsWith(".json"));
    return (
      await Promise.all(
        names.map((n) =>
          readFile(path.join(folder, n), "utf8").then(
            (s) => JSON.parse(s) as Project,
          ),
        ),
      )
    ).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }
  const { data, error } = await c
    .db!.from("projects")
    .select("snapshot")
    .eq("user_id", c.userId)
    .order("updated_at", { ascending: false })
    .limit(100);
  if (error)
    throw new AppError(
      "Could not load projects. Check the database migration and connection.",
      503,
    );
  return data.map((row) => row.snapshot as Project);
}
export async function getProject(c: Context, id: string): Promise<Project> {
  validId(id);
  if (c.demo) {
    try {
      return JSON.parse(await readFile(file(id), "utf8"));
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === "ENOENT")
        throw new AppError("Project not found.", 404);
      throw e;
    }
  }
  const { data, error } = await c
    .db!.from("projects")
    .select("snapshot")
    .eq("id", id)
    .eq("user_id", c.userId)
    .single();
  if (error || !data) throw new AppError("Project not found.", 404);
  return data.snapshot as Project;
}
export async function saveProject(c: Context, p: Project) {
  validId(p.id);
  if (c.demo) {
    await mkdir(folder, { recursive: true });
    const tmp = `${file(p.id)}.${crypto.randomUUID()}.tmp`;
    await writeFile(tmp, JSON.stringify(p), "utf8");
    await rename(tmp, file(p.id));
    return;
  }
  const { error } = await c.db!.rpc("save_project_snapshot", {
    owner_id: c.userId,
    payload: p,
  });
  if (error)
    throw new AppError(
      "Could not save this project. Check the database migration and retry.",
      503,
    );
}
const globalState = globalThis as typeof globalThis & {
  reviewAngleLocks?: Set<string>;
};
const locks = (globalState.reviewAngleLocks ||= new Set());
export async function locked<T>(
  c: Context,
  id: string,
  action: () => Promise<T>,
): Promise<T> {
  const key = `${c.userId}:${id}`;
  const lease = crypto.randomUUID();
  if (locks.has(key))
    throw new AppError(
      "This project is processing another request. Wait a moment and resume.",
      409,
    );
  locks.add(key);
  try {
    if (!c.demo) {
      const { data, error } = await c.db!.rpc("claim_project", {
        owner_id: c.userId,
        project_key: id,
        lease_key: lease,
      });
      if (error)
        throw new AppError(
          "Unable to reserve this analysis step. Retry shortly.",
          503,
        );
      if (!data)
        throw new AppError(
          "This project is already processing. Resume shortly.",
          409,
        );
    }
    return await action();
  } finally {
    locks.delete(key);
    if (!c.demo) {
      const { error } = await c.db!.rpc("release_project", {
        owner_id: c.userId,
        project_key: id,
        lease_key: lease,
      });
      if (error)
        throw new AppError(
          "Progress was saved, but the processing lock could not be released. Resume after ten minutes.",
          503,
        );
    }
  }
}
export async function reserve(
  c: Context,
  key: string,
  kind: "reviews" | "followup" | "url",
  amount: number,
) {
  if (c.demo) return;
  const allowance =
    kind === "reviews"
      ? limit("FREE_REVIEW_LIMIT", 500)
      : kind === "followup"
        ? limit("FREE_FOLLOWUP_LIMIT", 30)
        : 20;
  const { data, error } = await c.db!.rpc("reserve_usage", {
    owner_id: c.userId,
    event_key: key,
    event_kind: kind,
    units: amount,
    allowance,
  });
  if (error)
    throw new AppError(
      "Unable to check your usage allowance. Retry shortly.",
      503,
    );
  if (!data)
    throw new AppError(
      "Your free monthly allowance is used up. Reduce the batch or return next month.",
      429,
    );
}
