# ReviewAngle AI implementation

## Plan and status

- [x] Inspect repository: empty GitHub repository, cloned locally.
- [x] Define architecture and implementation decisions.
- [x] M1: Next.js foundation, ingestion, normalization, fixtures, deterministic tests.
- [x] M2: Structured Responses pipeline, aggregation, scores, traceability, mock integration tests.
- [x] M3: Supabase schema/RLS, email authentication, persistence, quotas, durable analysis steps.
- [x] M4: Responsive bilingual workspace, import preview, results, evidence, follow-ups, exports.
- [x] M5: Safe public HTML connectors and manual fallback.
- [x] M6: Run tests/build, exercise desktop/mobile/Arabic workflows, deployment documentation.

## Decisions

- Local demo mode is explicit, synthetic, isolated from authenticated production data, and uses a deterministic fixture provider; it never impersonates live AI.
- Production requires Supabase and OpenAI credentials. No secrets are committed.
- Process bounded batches via resumable HTTP steps, persisting progress after every step. This avoids relying on background work surviving a serverless request.
- CSV and TXT are first-class; XLSX is optional and deferred unless it adds little risk.
- Counts and scores are application-computed. Model output may select evidence only from validated input IDs.
- URL import only reads public HTML, observes robots policy, and does not execute third-party JavaScript.
- Next.js standalone Docker deployment is the primary portable deployment target; no deployment is performed in this implementation task.

## Validation log

- Production build and TypeScript validation passed on Node 24, Next.js 16.3.4, React 19.2.8.
- 50 unit/integration tests pass with no paid API calls. Includes real Responses SDK schema helper, mocked model responses, bounded extraction, quote validation, CSV, normalization, duplicates, phrase counts, score caps, connector HTML, DNS pinning, SSRF redirects/timeouts/size caps, and embedded PostgreSQL migration/RLS/quotas/leases/relational evidence.
- Four browser workflows passed: desktop analysis, evidence, translation setup recovery, hooks, UGC follow-ups, saving, JSON export and persisted history; Arabic mobile layout at 390px; malformed CSV and missing column recovery; direct paste and CSV analysis with actual clipboard verification.
- Fixed localhost origin mismatch exposed by the browser test, in-dialog error visibility, and scroll reset between sections.
- Original fixture examples are labeled synthetic throughout. Demo analysis is deterministic and never presented as live OpenAI output.
- Standalone production server smoke test passed: root returned 200; demo stayed disabled even with DEMO_MODE=true; the unconfigured production API returned the intended 503 instead of granting demo access.

## Repository delivery

- The baseline was subsequently published to GitHub `main` as `a206cf116608fe1aeda4b1331d575a5c53c14700`. The initial upload permission failure was resolved before Phase 2.
- Phase 2 continues that baseline in the existing configured checkout; it does not rebuild the project. See the Phase 2 validation record below.

## External validation still required before launch

- Verify real Supabase email delivery/session renewal and authenticated remote persistence once Supabase environment variables are configured. The migration and real OpenAI local staging analyses were verified in Phase 2 below.
- Build/run the Docker image on a Docker host. Docker was not installed here; Next.js standalone production output was built successfully.
- Permit and live-validate each merchant domain before enabling URL imports. Widget HTML fixtures pass, but no live merchant site is certified.
- XLSX, Google login and PDF export remain intentionally outside this MVP.

## Phase 2 staging validation (2026-09-06)

- Continued the existing `main` implementation from `a206cf116608fe1aeda4b1331d575a5c53c14700` in the configured checkout. Reused its ignored OpenAI key without changing it.
- Added strict opt-in local staging: real OpenAI provider; arbitrary Paste/CSV/TXT; ignored `.local/staging/` persistence; separate synthetic demo storage/provider; localhost host/origin/proxy checks; loopback-only launcher; production refusal in both configuration and request handling. Supabase authentication/persistence/quotas are bypassed only in local staging.
- Unit/integration suite: 69 passed, including 19 local staging tests. Typecheck and final production build passed with filesystem caching disabled.
- Browser suite: all 4 synthetic regression workflows passed; all 3 live staging workflows passed. Fixed the desktop test to wait for completed results rather than the heading rendered during processing.
- Real `gpt-6-astra` runs: English (3 reviews, 9 themes, 5 angles) and Egyptian Arabic (3 reviews, 10 themes, 5 angles). Verified exact source quotes, review/theme IDs, counts, insight/angle evidence unions, language output, browser evidence dialogs and persisted history. TXT import/persistence and hostile request rejection passed as well.
- Negative production checks: both the staging launcher and `next start` refused `LOCAL_STAGING_MODE=true` under `NODE_ENV=production`.
- Supabase project `hdtkzoksuxdmabxfxeyu`: confirmed applied migration `20260906194349_initial_schema` and RLS enabled on all 11 public tables. No schema changes or migration replay were performed. Supabase email/session and remote persistence remain separate launch checks because the local checkout has no service-role or public Supabase configuration.
- Secret audit detected environment values in three existing Turbopack disk-cache files, not in source, diffs, browser logs, local analysis data or deployment output. Disabled filesystem caching for development and builds, and excluded env/local data from deployment tracing. Cleanup was blocked by automatic approval review; manual cache removal and a clean audit are required before declaring the artifact audit complete. The audit prints filenames/counts only.
