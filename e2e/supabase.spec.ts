import { test, expect } from "@playwright/test";
import { createClient, type Session } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import type { Project } from "../src/lib/analysis/schema";

function checked<R extends { data: unknown; error: unknown }>(
  result: R,
  label: string,
): NonNullable<R["data"]> {
  if (result.error)
    throw new Error(
      `${label} failed; provider details suppressed to protect credentials.`,
    );
  return result.data as NonNullable<R["data"]>;
}
test("real Supabase password login, renewal, authenticated analysis, relational persistence and RLS", async ({
  page,
  request,
}) => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const options = { auth: { persistSession: false, autoRefreshToken: false } };
  const admin = createClient(
    url,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    options,
  );
  const owner = createClient(url, key, options),
    other = createClient(url, key, options);
  const users: string[] = [];
  const started = Date.now();
  let phase = "temporary Auth account setup";
  let session: Session | null = null;
  try {
    // Temporary confirmed accounts validate Auth without pretending that email
    // delivery/public signup has been verified. That is a separate manual gate.
    for (const client of [owner, other]) {
      const email = `reviewangle-phase2-${randomUUID()}@example.com`;
      const password = `${randomUUID()}Aa!9`;
      const created = checked(
        await admin.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
        }),
        "Create temporary Auth user",
      );
      if (!created.user)
        throw new Error("Temporary Auth user was not returned.");
      users.push(created.user.id);
      const signed = checked(
        await client.auth.signInWithPassword({ email, password }),
        "Password login",
      );
      expect(!!signed.session).toBe(true);
      if (client === owner) session = signed.session;
      expect(
        checked(await client.auth.getUser(), "Authenticated session").user
          ?.id === created.user.id,
      ).toBe(true);
    }
    phase = "session renewal";
    const renewed = checked(
      await owner.auth.refreshSession(),
      "Session renewal",
    );
    expect(!!renewed.session && renewed.session.user.id === users[0]).toBe(
      true,
    );
    session = renewed.session;
    if (!session) throw new Error("Renewed session missing.");
    const auth = { authorization: `Bearer ${session.access_token}` };
    expect((await request.get("/api/projects")).status()).toBe(401);
    expect(
      (
        await request.get("/api/projects", {
          headers: { authorization: "Bearer invalid-test-token" },
        })
      ).status(),
    ).toBe(401);
    phase = "authenticated project creation";
    const create = await request.post("/api/projects", {
      headers: auth,
      data: {
        name: "NON-CUSTOMER Supabase validation",
        language: "en",
        reviews: [
          {
            text: "The travel mug keeps my tea warm during the commute. The lid has not leaked in my work bag.",
          },
          {
            text: "I take the mug to the office because coffee stays warm. Cleaning under the lid takes too much time.",
          },
          {
            text: "The handle feels comfortable while walking. The mug is too wide for my car cup holder.",
          },
        ],
      },
    });
    expect(create.status()).toBe(201);
    let p: Project = (await create.json()).project;
    expect(p.demo).toBe(false);
    expect(p.run.model.includes("synthetic")).toBe(false);
    expect(
      checked(
        await admin.from("profiles").select("id").eq("id", users[0]),
        "Profile creation",
      ).length,
    ).toBe(1);
    phase = "authenticated OpenAI analysis";
    for (let i = 0; i < 10 && p.run.stage !== "complete"; i++) {
      const response = await request.post(`/api/projects/${p.id}/step`, {
        headers: auth,
        data: {},
      });
      expect(response.ok()).toBe(true);
      p = (await response.json()).project;
      expect(p.run.stage === "failed").toBe(false);
    }
    expect(p.run.stage).toBe("complete");
    const followup = await request.post(`/api/projects/${p.id}`, {
      headers: auth,
      data: { action: "hooks", angleId: p.angles[0].id },
    });
    expect(followup.ok()).toBe(true);
    p = (await followup.json()).project;
    expect(p.followups.length).toBe(1);
    phase = "relational persistence and RLS";
    const expected: Record<string, number> = {
      projects: 1,
      sources: 1,
      reviews: p.reviews.length,
      analysis_runs: 1,
      themes: p.themes.length,
      insights: p.insights.length,
      angles: p.angles.length,
      angle_evidence: p.angles.reduce(
        (n, a) => n + new Set(a.reviewIds).size,
        0,
      ),
      followups: 1,
    };
    for (const [table, count] of Object.entries(expected)) {
      const column = table === "projects" ? "id" : "project_id";
      const stored = checked(
        await admin.from(table).select("*").eq(column, p.id),
        `${table} service-role read`,
      );
      expect(stored.length).toBe(count);
      expect(stored.every((row) => row.user_id === users[0])).toBe(true);
      expect(
        checked(
          await owner.from(table).select("*").eq(column, p.id),
          `${table} owner read`,
        ).length,
      ).toBe(count);
      expect(
        checked(
          await other.from(table).select("*").eq(column, p.id),
          `${table} cross-user isolation`,
        ).length,
      ).toBe(0);
    }
    expect(
      checked(
        await other.from("profiles").select("id").eq("id", users[0]),
        "Profile isolation",
      ).length,
    ).toBe(0);
    expect(
      !!(
        await owner
          .from("projects")
          .update({ name: "Forbidden" })
          .eq("id", p.id)
      ).error,
    ).toBe(true);
    expect(
      !!(
        await owner.rpc("save_project_snapshot", {
          owner_id: users[0],
          payload: p,
        })
      ).error,
    ).toBe(true);
    const otherSession = checked(
      await other.auth.getSession(),
      "Other user session",
    ).session;
    expect(
      (
        await request.get(`/api/projects/${p.id}`, {
          headers: { authorization: `Bearer ${otherSession!.access_token}` },
        })
      ).status(),
    ).toBe(404);
    expect(
      checked(
        await owner.from("usage_events").select("kind,units"),
        "Usage events",
      ).some((e) => e.kind === "reviews" && e.units === p.reviews.length),
    ).toBe(true);
    expect(
      checked(
        await other.from("usage_events").select("id").eq("user_id", users[0]),
        "Usage isolation",
      ).length,
    ).toBe(0);
    const reservation = {
      owner_id: users[0],
      event_key: randomUUID(),
      event_kind: "integration-audit",
      units: 2,
      allowance: 2,
    };
    expect(
      checked(
        await admin.rpc("reserve_usage", reservation),
        "Quota reservation",
      ),
    ).toBe(true);
    expect(
      checked(
        await admin.rpc("reserve_usage", reservation),
        "Quota idempotency",
      ),
    ).toBe(true);
    expect(
      checked(
        await admin.rpc("reserve_usage", {
          ...reservation,
          event_key: randomUUID(),
        }),
        "Quota cap",
      ),
    ).toBe(false);
    const lease = {
      owner_id: users[0],
      project_key: p.id,
      lease_key: randomUUID(),
    };
    expect(
      checked(await admin.rpc("claim_project", lease), "Lease claim"),
    ).toBe(true);
    expect(
      checked(
        await admin.rpc("claim_project", { ...lease, lease_key: randomUUID() }),
        "Lease exclusion",
      ),
    ).toBe(false);
    checked(await admin.rpc("release_project", lease), "Lease release");
    expect(
      checked(await admin.rpc("claim_project", lease), "Lease reclaim"),
    ).toBe(true);
    checked(await admin.rpc("release_project", lease), "Final lease release");

    phase = "browser session refresh and persisted history";
    let refreshRequests = 0;
    page.on("request", (req) => {
      if (req.url().includes("grant_type=refresh_token")) refreshRequests++;
    });
    const storageKey = `sb-${new URL(url).hostname.split(".")[0]}-auth-token`;
    await page.addInitScript(
      ({ storageKey, session }) => {
        if (!localStorage.getItem(storageKey))
          localStorage.setItem(
            storageKey,
            JSON.stringify({ ...session, expires_at: 1 }),
          );
      },
      { storageKey, session },
    );
    await page.goto("/");
    await expect(
      page.getByText("Local staging — real OpenAI, local data", {
        exact: true,
      }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Sign out", exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: /All projects/ }).click();
    await expect(
      page.getByRole("button", { name: /NON-CUSTOMER Supabase validation/ }),
    ).toBeVisible();
    await page.reload();
    await page.getByRole("button", { name: /All projects/ }).click();
    await expect(
      page.getByRole("button", { name: /NON-CUSTOMER Supabase validation/ }),
    ).toBeVisible();
    expect(refreshRequests).toBeGreaterThan(0);
    await mkdir(".local/validation", { recursive: true });
    await writeFile(
      ".local/validation/supabase-http.json",
      JSON.stringify(
        {
          passed: true,
          passwordLogin: true,
          sessionRefresh: true,
          browserHistory: true,
          relationalTables: Object.keys(expected),
          rlsIsolation: true,
          quotaLease: true,
          localStagingMode: false,
          model: p.run.model,
          durationMs: Date.now() - started,
          emailDeliveryAndPublicSignup: "separate manual gate",
        },
        null,
        2,
      ),
    );
  } catch {
    // Playwright network errors can embed request headers. Never let a raw
    // transport/provider error containing bearer credentials reach reports.
    throw new Error(
      `Supabase validation failed during ${phase}; raw diagnostics suppressed to protect credentials.`,
    );
  } finally {
    await page.close();
    await owner.auth.signOut();
    await other.auth.signOut();
    for (const id of users)
      checked(
        await admin.auth.admin.deleteUser(id),
        "Delete temporary validation user and cascaded test data",
      );
  }
});
