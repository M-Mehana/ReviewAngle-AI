# Architecture

Next.js App Router + TypeScript + React + Tailwind + Radix accessible primitives. Node runtime hosts authenticated route handlers. Supabase provides PostgreSQL and email OTP authentication. OpenAI Responses uses Zod structured outputs. Browser never receives service credentials.

## Modules

- `lib/ingestion`: paste/CSV/TXT parsing, mapping, normalization, duplicate detection, language heuristics and PII masking.
- `lib/connectors`: isolated public HTML connectors, domain policy, bounded DNS-pinned HTTP fetching.
- `lib/analysis`: schemas, per-review extraction, deterministic aggregation and voice-of-customer verification, intelligence and angle generation, evidence scoring.
- `lib/server`: authenticated persistence, request validation, quota reservation, resumable run execution.
- `lib/exports`: spreadsheet-safe CSV and JSON.
- `components`: bilingual workspace, import preview, project history, evidence and angle dialogs.
- `supabase/migrations`: user-owned relational records and RLS.

## Analysis flow

Ingest → normalize + reject/flag duplicates → permanently identify reviews → extract batches (original-language text, obvious PII masked) → canonical theme mapping → count distinct supporting review IDs → verify verbatim phrases → generate grounded intelligence → generate ~10 angles when evidence permits → calculate scores → persist. Each stage has an explicit status, extraction failures remain visible and excluded from the denominator. Retry resumes missing work. Reviews are untrusted data, never instructions. Every theme, insight and angle is checked against the analyzed review set. No invented quote is stored as original evidence.

## Storage

Profiles (Supabase auth users), projects, sources, reviews, analysis_runs, themes, insights, angles, angle_evidence, followups, usage_events. All user data carries ownership enforced by RLS. Reviews remain immutable within a saved analysis. Run snapshots support atomic progress commits and recovery; normalized result tables support future queries. Analysis quota is reserved atomically before paid calls. Free allowances and per-project limits are configurable. Demo persistence uses a local JSON file, only when explicitly enabled and bound to localhost, never production.

## Evidence score v1

0–100 evidence confidence index, NOT predicted ad performance. For supporting reviews: frequency = min(1, distinct support / analyzed total / 0.25); consistency = fraction of extracted supporting records matching every theme cited by the angle; emotion = fraction with verified emotional quotes; specificity = fraction with verified quotes of >= 40 characters; usability = fraction with benefit/pain/outcome/use-case evidence. Weighted sum: 35% frequency, 25% consistency, 15% emotion, 15% specificity, 10% usability. Apply small-sample cap: 1 review 40, 2 reviews 60, 3–4 reviews 75, 5+ 100. Scores are heuristic and versioned; labels limited (<45), emerging (45–69), strong (70+). Theme assignments are model-assisted and can be imperfect; supporting originals always remain reviewable.

## Security and deployment

Validate request size and schema and verify Supabase bearer identity via auth.getUser(). The API uses a server-only service-role database client, explicitly scopes every query/RPC to the verified owner, and never accepts an owner ID from the browser. Privileged RPC execution and direct table writes are denied to anon/authenticated roles. RLS read policies use auth.uid(); this is separate from the server's explicit ownership checks. Requests are limited to 120 per minute per user using an atomic PostgreSQL reservation. Same-origin browser mutations. Public fetching rejects non-HTTP(S), credentials, custom ports, local/reserved addresses, IPv4-mapped IPv6 and any DNS answer outside global unicast. Connect to the validated IP via custom DNS lookup (prevent rebinding), revalidate every redirect, enforce overall timeout and byte cap, honor robots.txt, never solve challenges. Restrictive response headers and no raw HTML rendering. CSV formula injection is escaped. Deploy standalone Node container + Supabase + OpenAI, HTTPS, external egress firewall as defense in depth. No provider-specific jobs required; client advances durable steps and can resume after disconnects. Production validation requires real service credentials and database migration application.
