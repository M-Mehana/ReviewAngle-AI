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

- Real Supabase email delivery/confirmation was user-confirmed; automated HTTP/session/persistence validation passed locally. See the current Phase 2 record below.
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

## Earlier Phase 2 checkpoint (2026-09-07; superseded by current validation below)

- Configured the existing staging project's public URL and legacy anon key in ignored `.env.local`; the private OpenAI value was preserved. The server service-role key is still absent. Auth settings confirm email signup is enabled and requires confirmation; anonymous Data API access is rejected.
- Executed `scripts/validate-supabase-database.sql` against `hdtkzoksuxdmabxfxeyu`: real service-role SQL writes, repeated snapshot writes, all 11 table ownership policies, profile creation, relational evidence/followups, quota/idempotency/request limits, and lease claim/release passed. Temporary test users/data were rolled back. No migration/schema was changed. These are hosted database-role checks, not HTTP Auth/session verification.
- Added `pnpm test:supabase`: an opt-in real HTTP/browser validation of password login for two temporary confirmed accounts, refresh, authenticated OpenAI analysis, relational persistence, RLS, quota/leases and browser history. Tokens stay in memory, raw transport diagnostics are suppressed, and traces/screenshots/video are disabled. Running it currently reports the missing `SUPABASE_SERVICE_ROLE_KEY`; it is not counted as passed. Public signup/email delivery remains a separate check requiring a user-provided test mailbox. The product's email-OTP UI is unchanged.
- Added 50/200-review deterministic load tests: 16/56 bounded provider-double calls, 94/575 ms in the recorded run, no paid calls. All rows survive normalization/duplicate checks, evidence quotes/IDs/counts remain valid, and scores are application-computed. Fixtures are explicitly NON-CUSTOMER performance data. A blank genuine-review CSV template and 200-row load fixture can be generated with `node scripts/prepare-validation-data.mjs`.
- Regression: 78 tests and typecheck pass; production build and all 4 default browser workflows pass. New production-context tests verify missing/invalid sessions fail closed and do not activate a local/demo bypass. Prior live English/Egyptian Arabic OpenAI results remain valid; provider prompts and product behavior were not changed.
- Secret audit now distinguishes the intentionally public Supabase anon/publishable browser key from private keys, including a regression for service-role values mistakenly placed in the public slot. The original three ignored Turbopack cache files still match the private key. Automatic approval review again blocked their deletion; manual cleanup is pending. No private-key matches were found in source, diffs, deployment output or validation/test artifacts outside those cache files.
- Genuine 50–200-review validation is pending user-provided CSV/TXT. No restricted scraping, invented customer reviews, or prompt tuning to synthetic data was performed.
- At this checkpoint, Phase 2 was not done: HTTP Auth/session/persistence, public email confirmation, cache cleanup and genuine-review quality were outstanding. The current record below supersedes these historical blockers.

## Current Phase 2 validation (2026-09-07)

- The configured checkout now has the required credentials in ignored `.env.local`. The existing OpenAI key was reused without rotation or replacement.
- The local real Supabase HTTP/browser report records successful password login, session refresh, authenticated OpenAI analysis, nine relational persistence tables, owner isolation, quotas/leases and browser history. Public signup/email delivery and confirmation were separately verified by the user, not by the admin-created-account test.
- The user removed the old Turbopack caches; the initial rerun audited 677 files with zero private-secret matches. Filesystem caches remain disabled.
- Genuine-review validation used two separate private local CSVs and real OpenAI through the existing local staging pipeline. Customer data and reports remain under ignored `.local/`; genuine reviews were not sent to Supabase or committed.
- Found two Arabic near-duplicate pairs missed because of letter elongation, spelling and joined-word differences. Added comparison-only folding and bounded edit similarity for long Arabic copies, with negation protection; originals and exact-quote evidence remain unchanged. New synthetic regressions reproduce the miss and protect short praise, distinct experiences and changed negation. All 97 Arabic rows normalize; two near duplicates leave 95 for analysis. Four exact English duplicates leave 96 of 100 rows; the fix does not change that dataset's selection.
- Two English intelligence responses referenced missing evidence and were rejected before persistence. Constrained insight/angle structured-output schemas to the supplied theme IDs and added request-schema/unknown-ID regression coverage. No prose prompt tuning was performed. Reused validated full-dataset extraction/grouping when rerunning these downstream stages.
- English → English: final constrained run passed on 96 reviews, 242 themes and ten distinct angles. Exact quotes, review/theme IDs, unique counts, evidence unions and deterministic scores passed. Manual review found natural English, qualified persona hypotheses and no material unsupported claims or invented statistics. Single-review themes remain visible as limited observations; they do not independently drive the angles.
- English → Egyptian Arabic: the first full run passed on 96 reviews, 245 themes and ten distinct angles, with clean evidence checks and natural Egyptian wording. The constrained-schema rerun completed intelligence but is blocked at angle generation by exhausted API credits; it is not counted as final completion.
- Arabic → Arabic: the first run rejected an invalid extraction ID. A fresh run after duplicate correction extracted all 95 distinct reviews and completed theme grouping for 80 of them before credits were exhausted. Final Arabic intelligence/angles and their semantic quality remain unverified.
- Final code regression: 82 unit/integration tests, typecheck, production build and all four default browser workflows passed. Two earlier real Supabase HTTP/browser reruns passed; the latest run after the schema change failed during authenticated OpenAI analysis when API credits were exhausted. Public email confirmation remains separately user-confirmed.
- A no-retry diagnostic confirmed HTTP 429 with `credit_balance_exhausted` and `insufficient_quota`; this is not transient throttling. No key was rotated or replaced. Paid requests stopped, and checkpoints are resumable.
- The private-secret scanner reports zero matches across source, diffs, local data, logs and build/test artifacts. Customer inputs, generated reports and environment files remain ignored and untracked. The final delivery reports post-push CI separately; CI does not run paid genuine-review or hosted Supabase checks.
- **Phase 2: NOT DONE.** Exact blockers: restore usable API credits; finish the 95-review Arabic analysis using the constrained-ID provider and manually assess Arabic quality; finish/review the final Egyptian angle rerun; rerun real Supabase integration successfully; repeat the artifact audit and verify delivery CI. No Phase 3 work was started.
