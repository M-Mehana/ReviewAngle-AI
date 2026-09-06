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

- Source is committed on local `main`; source ZIP and a complete Git bundle were created for delivery.
- Remote upload could not complete: local Git has no credentials, and the authenticated GitHub plugin returned HTTP 403, `Resource not accessible by integration`, for a file write. The remote repository remains unchanged.
- After GitHub Contents write access or local Git authentication is configured, publish with `git push -u origin main` from this checkout. No force push is needed while the remote remains empty.

## External validation still required before launch

- Configure real Supabase/OpenAI environment variables, apply the migration to the target Supabase project, and verify email delivery/session renewal and a real paid analysis. No credentials were available in this environment.
- Build/run the Docker image on a Docker host. Docker was not installed here; Next.js standalone production output was built successfully.
- Permit and live-validate each merchant domain before enabling URL imports. Widget HTML fixtures pass, but no live merchant site is certified.
- XLSX, Google login and PDF export remain intentionally outside this MVP.
