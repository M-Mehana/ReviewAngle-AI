# ReviewAngle AI

An evidence-first customer research workspace. Import reviews, extract customer insights in bounded stages, inspect the original evidence behind every angle, generate grounded follow-ups, and export the results. Arabic-first interface with an optional English interface; generated marketing output supports Arabic MSA (`ar`), Egyptian (`ar-EG`) and Gulf/Saudi (`ar-SA`) only. English, Arabic and mixed source reviews remain supported; original evidence keeps its source language. Historical English projects are readable/exportable, but cannot start new English generation.

## Arabic-first Phase 2 closeout (2026-09-09)

**Phase 2 DONE locally.** Generated output supports only Arabic MSA (`ar`), Egyptian Arabic (`ar-EG`) and Gulf/Saudi Arabic (`ar-SA`). Neutral Arabic is the default; Arabic result dialogs remain RTL even with the English interface. English/Arabic/mixed source reviews and original-language evidence remain supported. English output is disabled for new analyses; historical English projects remain readable/exportable without paid regeneration. The earlier 96-review English output pass is historical evidence, not a current completion gate.

The genuine MSA set contains four distinct supported motivations and four executions: purchase confidence/social proof, brow density/routine, lash length/close-up and non-oily texture/product feature. Exactly one execution explicitly presents customer reviews. Two existing angles were preserved; only two excess social-proof slots were repaired. Egyptian's five distinct angles and all evidence stages were preserved without regeneration. Mild formality in existing Egyptian summaries is nonblocking for this scope. Gulf/Saudi support passed deterministic checks; no large paid Gulf validation was required.

FAST and QUALITY remain `gpt-5.6-luna`; optional FALLBACK remains `gpt-5.6-terra`. This genuine attempt made two Luna repairs and two Terra fallbacks (8,110 reported tokens), with no extraction/grouping/intelligence/English/Egyptian regeneration. Both accepted replacements are exact saved Terra responses. A harness assertion initially blocked one slot before API use; it was resumed only after confirming zero requests for it. Missing Arabic close-up/product-feature aliases were corrected and replayed offline; no extra generation or softened claim gate was used. No final angle was omitted after that offline correction.

Exact stored quotes, review/theme IDs, unique counts, evidence unions and deterministic scores passed. Retained outputs passed manual checks for unsupported claims, product-target crossover, invented creator testimony, timeframe/frequency promises, localization and meaningful creative variety. These are evaluated dataset results, not a guarantee that lexical guards catch every future semantic error.

Final validation: 221 deterministic tests, typecheck, production build, five browser workflows and fresh real Supabase auth/session/relational persistence/RLS validation passed. Public email delivery/confirmation remains the separately user-confirmed prior pass. Secret cache cleanup remains effective; the final secret/customer-data audit is clean. Private credentials, customer datasets and validation artifacts remain ignored. Phase 3 has not started.

## Local setup

Requires Node.js 24 LTS and pnpm 11. Install dependencies with the committed lockfile:

```sh
git clone https://github.com/M-Mehana/ReviewAngle-AI.git
cd ReviewAngle-AI
corepack enable
pnpm install --frozen-lockfile
cp .env.example .env.local
```

On Windows PowerShell, use `Copy-Item .env.example .env.local` instead of `cp` if preferred. If Corepack is unavailable, install pnpm with `npm install -g pnpm@11.19.0`.

### Run immediately with synthetic fixtures (no paid API calls)

Set `DEMO_MODE=true` in `.env.local`, then:

```sh
pnpm dev
```

Open http://127.0.0.1:3000. Choose English, Arabic or Mixed in **Try a synthetic example**, preview, then analyze. These are twelve fictional bottle reviews and an explicitly labeled deterministic fixture provider. It only accepts the bundled fixture text; it cannot analyze arbitrary customer reviews. Paste/CSV/TXT parsing and preview work for arbitrary inputs, but real analysis requires the services below. Local demo projects persist in ignored `.local/*.json` files and are not synced to Supabase. Demo mode is disabled in production regardless of the environment flag and must only run on a trusted localhost machine.

### Real Supabase / OpenAI setup

1. Create a Supabase project. Copy its project URL, anon/publishable-compatible legacy anon key and server service role key into `.env.local`. **Never prefix the service role key with `NEXT_PUBLIC_`.**
2. Apply `supabase/migrations/202609060001_initial.sql` in the Supabase SQL editor, or use the CLI migration flow below.
3. Enable email authentication in Supabase. Set Site URL and allowed redirect URLs to the app origin (local: `http://127.0.0.1:3000`; production: your HTTPS origin). Configure production SMTP before public launch. Sign-in emails support the default magic link; to offer a typed code, include `{{ .Token }}` in the Magic Link email template. The client accepts 6–8 digit OTPs.
4. Set `OPENAI_API_KEY` to a project-scoped key. Optionally select `OPENAI_MODEL_FAST` for extraction/grouping and `OPENAI_MODEL_QUALITY` for intelligence, angles, hooks, UGC and translation. Each unset/blank tier falls back to `OPENAI_MODEL`, then the existing `gpt-6-astra` default. `OPENAI_MODEL_FALLBACK` is a separate optional model for individual items that fail one QUALITY repair; blank disables escalation. Use Responses structured-output models available to your account. Set a spending limit in your OpenAI account.
5. Set `DEMO_MODE=false`, set `APP_ORIGIN`, restart the development server, sign in and analyze your own reviews.

The server verifies the Supabase access token on every request. Tables are private with owner-only RLS reads. Only the server service role can write or invoke persistence, lease and quota functions; every server query and function is scoped to the verified user. No database service key or OpenAI key reaches the browser. Supabase's public URL and anon key are intentionally public.

### Migrations with the Supabase CLI

Install the [Supabase CLI](https://supabase.com/docs/guides/local-development/cli/getting-started), authenticate, and then:

```sh
supabase link --project-ref YOUR_PROJECT_REF
supabase db push
```

For a local Supabase stack, Docker is required; run `supabase init`, `supabase start`, and `supabase db reset`, then use the local credentials printed by the CLI. The standard unit suite runs the same SQL migration in embedded PostgreSQL (PGlite), including RLS and privilege tests, without Docker or cloud credentials.

## Environment variables

| Variable                        | Purpose                                                                            |
| ------------------------------- | ---------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`      | Supabase project URL, compiled into the client                                     |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public auth client key, compiled into the client                                   |
| `SUPABASE_SERVICE_ROLE_KEY`     | Server-only database access; verified owner filtering on every operation           |
| `OPENAI_API_KEY`                | Server-only Responses API key                                                      |
| `OPENAI_MODEL`                  | Structured-output model; defaults to `gpt-6-astra`                                 |
| `OPENAI_MODEL_FAST`             | Optional extraction/grouping override; blank uses `OPENAI_MODEL`                   |
| `OPENAI_MODEL_QUALITY`          | Optional intelligence/creative/localization override; blank uses `OPENAI_MODEL`    |
| `OPENAI_MODEL_FALLBACK`         | Optional individual-item escalation after failed QUALITY repair; blank disables it |
| `DEMO_MODE`                     | Explicit localhost synthetic mode, never enabled in production                     |
| `NEXT_PUBLIC_DEMO_MODE`         | Reserved public demo flag; server remains authoritative                            |
| `APP_ORIGIN`                    | Trusted app origin for browser mutations and deployment                            |
| `FREE_REVIEW_LIMIT`             | Monthly review allowance, default 500; full batch reserved once per run            |
| `MAX_REVIEWS_PER_PROJECT`       | Server cap, default 200; UI currently also caps at 200                             |
| `FREE_FOLLOWUP_LIMIT`           | Monthly follow-up/translation attempt allowance, default 30                        |
| `URL_SUPPORTED_DOMAINS`         | Comma-separated explicitly permitted domains, including their subdomains           |
| `URL_DISABLED_DOMAINS`          | Explicitly disabled domains; overrides supported policy                            |

All optional limits must be positive integers. URL imports have a monthly allowance of 20 attempts. Authenticated API requests have a database-backed rolling limit of 120 requests per minute per user. Failed paid requests can still consume provider resources; review reservations and follow-up attempts are not automatically refunded. Reopening/resuming the same run does not charge the review allowance again.

## Workflow and limits

- **Paste:** one review per paragraph, with a blank line between reviews.
- **Files:** CSV with a header row and flexible text/rating/date/title mapping; TXT uses paragraph separation. UTF-8 and UTF-8 BOM supported; quoted multiline CSV supported. XLSX is intentionally deferred: export it as CSV.
- **Preview:** shows usable rows, exact duplicates, near duplicates and rejected rows. Arabic near-duplicate comparison tolerates letter elongation, minor spelling differences and joined words in long copies; originals remain intact. Changed negation and short generic praise are kept separate. Only review text is mandatory. Ratings outside 1–5 are ignored. Date strings remain source text so ambiguous locale dates are not silently reinterpreted.
- **Processing:** maximum 2 MB input, 200 reviews per project, 6,000 normalized characters per review. Long rows are reported, never silently truncated. HTML and invisible direction controls are removed from model input; originals remain intact in evidence. Language detection is a deterministic Arabic/Latin-script heuristic, not a multilingual language classifier.
- **Pipeline:** extraction batches of six; theme canonicalization batches of ten extracted reviews, reusing previous labels; deterministic unique-review counts; exact phrase counting; intelligence and angles from the top 80 themes with up to two verified excerpts each. All themes remain visible even when not included in generation. No full large review collection goes into a single prompt. A deterministic portfolio selects up to six distinct supported motivations and assigns execution/evidence modes before prose generation; fewer angles are returned when validation fails. Saved candidates are selectively repaired, without filling arbitrary slots. The fixture demo remains a separate deterministic example.
- **Recovery:** each request advances and persists one stage/batch. If the tab closes or the service fails, reopen the project and resume. Omitted review records are flagged and excluded from analysis counts. Retry missing reviews rebuilds derived insights, angles and follow-ups; original reviews keep their IDs. A crashed server's processing lease expires after ten minutes.
- **Evidence:** quote text must be an exact substring of the masked normalized review. Invalid quoted facts are discarded; unknown IDs fail the stage. Insight and angle response schemas restrict theme references to the IDs supplied in that request. Themes/insights/angles use server-derived ID links. An LLM can still misinterpret a real quote, so inspect originals before using marketing claims.
- **Scores:** see `ARCHITECTURE.md`; score v1 measures support within the sample, not predicted ad performance. Marketing text is labeled as generated. Requested evidence translations are labeled as AI translations and mask obvious contact details.
- **Exports:** copy individual hooks/content, copy all angles, spreadsheet-safe CSV, full JSON including original evidence, analysis settings and follow-ups. Treat downloaded JSON as customer data because it contains originals.

## Public URL connectors

Unknown domains default to `manual-import-only`. An operator should only add a domain to `URL_SUPPORTED_DOMAINS` after confirming permitted use. `URL_DISABLED_DOMAINS` takes precedence. ReviewAngle reads `robots.txt` and fails closed if it cannot be read or access is disallowed. It fetches bounded public HTML, never a logged-in page, third-party widget API or browser-rendered JavaScript.

Isolated parsers exist for Judge.me, Loox, Yotpo, Okendo, Stamped and generic schema.org/custom review HTML. They work only when the relevant review markup is present in the public HTML response; many installations load reviews dynamically and will need manual import. No CAPTCHA solving, login bypass, anti-bot evasion, hidden token use or network access-control bypass is implemented. No merchant-domain connector has been live-certified in this environment.

Fetching validates protocol/port/credentials, rejects local/private/reserved IPs and unsafe DNS answers, pins the validated address into the connection, revalidates redirects, limits redirect count, enforces total timeouts, and caps response size. Use an outbound firewall as defense in depth in production.

## Tests and validation

```sh
pnpm test        # deterministic logic, mocked pipeline, SQL/RLS, safe fetching; no paid calls
pnpm typecheck
pnpm build
```

For browser tests, run a localhost demo server in one terminal and the suite in another:

```sh
# .env.local must contain DEMO_MODE=true
pnpm dev
pnpm test:e2e
```

The browser suite uses installed Chrome by default (`channel: 'chrome'` in `playwright.config.ts`). For CI, use Playwright Chromium: install it with `pnpm exec playwright install --with-deps chromium`, then remove the channel setting or set `PLAYWRIGHT_CHROMIUM=true`. It covers desktop import→analysis→evidence→follow-ups→save→export→history, mobile Arabic RTL, and invalid CSV/mapping recovery. Browser tests write only labeled synthetic local projects. Run tests against a separate development instance, not a real user workspace.

## Deployment

Recommended MVP architecture: one stateless Node.js container behind an HTTPS reverse proxy, Supabase PostgreSQL/Auth and OpenAI. No Redis, separate queue or deployment-provider API is required. Analysis progress is persisted in PostgreSQL; browser requests advance stages. Keep HTTP request timeouts at least 300 seconds for bounded model calls and retries. For unattended/background large-scale processing, move the same stages behind a worker queue with scheduled retry and cancellation before raising the 200-review cap.

```sh
docker build \
  --build-arg NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co \
  --build-arg NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_PUBLIC_ANON_KEY \
  -t reviewangle-ai .
docker run --rm -p 3000:3000 --env-file .env.production reviewangle-ai
```

Apply migrations before starting the app. Set `DEMO_MODE=false`, `APP_ORIGIN=https://your-domain`, production SMTP, auth redirect URLs, provider spending limits, TLS and database backups. Public Next.js variables are build-time settings; rebuild when they change. The container runs as a non-root user with standalone Next.js output. It does not require a writable data volume in production.

Staging validation has exercised real Supabase login/session refresh, authenticated paid OpenAI analysis, relational persistence, RLS isolation, quotas, leases and browser history. Public email signup and confirmation were separately confirmed by the user. See `TASKS.md` for the remaining genuine-review quality gate. Before public launch, review your privacy/retention policy, configure edge request limits and monitoring, and verify permitted source domains. The app deliberately does not deploy itself or provision paid services.

## References

- [OpenAI Responses structured outputs](https://developers.openai.com/api/docs/guides/structured-outputs)
- [Next.js installation](https://nextjs.org/docs/app/getting-started/installation)
- [Supabase email passwordless auth](https://supabase.com/docs/guides/auth/auth-email-passwordless)
- [Supabase row-level security](https://supabase.com/docs/guides/database/postgres/row-level-security)

See `TASKS.md` for implementation and validation status, and `ARCHITECTURE.md` for boundaries and scoring.

## Phase 2 local staging

Run `pnpm dev:staging` from this checkout with an existing `OPENAI_API_KEY` in ignored `.env.local`. The launcher sets `LOCAL_STAGING_MODE=true`, forces `DEMO_MODE=false`, and binds only to `127.0.0.1`. Open `http://127.0.0.1:3000` (or `http://localhost:3000`). The banner reads **Local staging — real OpenAI, local data**.

This mode accepts arbitrary Paste, CSV and TXT reviews and uses the real `OpenAIProvider`. It bypasses Supabase authentication, database persistence and database quotas only for validated local requests. Projects and resumable progress live under ignored `.local/staging/`, separate from the synthetic demo's `.local/*.json`. Local staging is for one developer process, not a shared service. URL imports still require an authenticated account. Real analyses incur OpenAI usage charges.

`LOCAL_STAGING_MODE` defaults to false. Production startup/build rejects it when true. Local requests must have an exact `localhost` or `127.0.0.1` Host, matching port and same origin; external or ambiguous proxy headers are rejected. Never expose or tunnel the local server. Production authentication, RLS, persistence and quotas remain required. Set both `LOCAL_STAGING_MODE=false` and `DEMO_MODE=false` for production.

For automated validation in PowerShell (stop other port 3000 servers first):

```powershell
$env:PLAYWRIGHT_START_SERVER='true'
pnpm test:e2e  # synthetic regression suite; no paid calls
$env:LOCAL_STAGING_E2E='true'
pnpm test:e2e  # opt-in paid Arabic MSA + Egyptian Arabic analyses from English source reviews, evidence checks and TXT import
```

The live suite persists summaries under `.local/validation/` and checks review/theme IDs, exact source quotes, counts, language, browser evidence and project history. Unset `LOCAL_STAGING_E2E` to return to the default synthetic suite. Run `node scripts/check-secrets.mjs` to compare local credential values against source, diffs, logs, local data and build/test artifacts (including ZIP traces), without printing values. Only the original `.env.local` is excluded; dependencies and Git object storage are outside this artifact scan.

Turbopack's filesystem caches are disabled because they can retain server environment values. Deployment tracing and Docker exclude env files and local data. If upgrading an older checkout that already has disk caches, remove `.next/cache/turbopack` and `.next/dev/cache/turbopack` before running the audit. Never commit or share local env files, data or cache directories.

## Real Supabase integration validation

Use the existing staging project only. With its public URL/anon key and `SUPABASE_SERVICE_ROLE_KEY` configured directly in ignored `.env.local`, run `pnpm test:supabase`. The runner forces `DEMO_MODE=false` and `LOCAL_STAGING_MODE=false`, creates two temporary confirmed Auth users, validates password login/renewal and authenticated app persistence, and deletes those test users/data afterward. It makes a small paid OpenAI analysis plus a hooks request. It refuses missing credentials and never treats a skipped/blocked run as success. Traces, screenshots and video are disabled to keep bearer tokens out of artifacts.

This automated test does **not** claim to verify public signup confirmation or actual email delivery: confirmed test accounts are created with the admin API. Validate those separately with an authorized test mailbox. The existing product UI uses email OTP; no password UI has been added.

`scripts/validate-supabase-database.sql` independently checks the existing hosted schema's service-role writes, all 11 ownership policies, relational persistence, quota and lease RPCs using rollback-only test data. It changes no schema and is not a migration.

Run `node scripts/prepare-validation-data.mjs` to create a blank genuine-review CSV template and an explicitly NON-CUSTOMER 200-row load fixture under ignored `.local/validation-datasets/`. Use genuine, authorized product reviews for semantic marketing-quality evaluation; the generated data measures ingestion/batching/evidence handling only. The 50/200-row tests use 16/56 deterministic provider-double calls, with zero paid requests. To record their local timing summaries, set `WRITE_VALIDATION_REPORT=true` before `pnpm test`.

Run the secret audit after build/test servers stop so generated files do not change during scanning. The public Supabase anon/publishable key is intentionally allowed in browser output; a server-role key placed in that public slot is still flagged. Keep private credentials solely in `.env.local`.

### Previous Phase 2 gate: nano quality validation failed (2026-09-07)

Full private-dataset validation found and fixed missed Arabic near duplicates and repeated invalid theme references. English passed on 96 distinct reviews with ten angles using `gpt-6-astra`. After credits were restored, the remaining saved work resumed with the user-configured `gpt-5-nano`; completed extraction/grouping was retained, so these are mixed-model continuations, not full nano-only analyses.

Nano completed Egyptian angle generation on the saved 96-review evidence. All IDs, exact quotes, counts, evidence unions and deterministic scores passed, but the ten angles failed manual quality review: unsupported fit, durability, cooling and delivery promises; awkward phrasing; and inconsistent Egyptian localization. The Arabic run retained 95 extractions and grouping at 80 reviews; nano spent 11,968 output tokens on reasoning without returning structured grouping output, so final Arabic insights/angles remain unverified. Mechanical evidence validity is not a semantic quality pass.

Real Supabase HTTP/browser validation now passes with `gpt-5-nano`, including auth/session refresh, authenticated analysis, relational persistence, RLS, quotas, leases and history. Public email signup/confirmation remains separately user-confirmed. The previous 82 tests, typecheck, build and four browser regressions passed; no product source or prompt changes were made during the nano continuation. Secret-cache cleanup and the artifact scan remain clean. Phase 2 is **NOT DONE** pending acceptable Egyptian output and completion/assessment of Arabic output. No automatic model upgrade was performed. Private reviews, checkpoints and quality reports stay in ignored local storage.

### Previous Phase 2 gate: routed models, semantic failures remain (2026-09-07)

Per-stage routing now supports the approved `gpt-5.6-luna` FAST and `gpt-5.6-terra` QUALITY configuration. Blank tier overrides preserve existing `OPENAI_MODEL` installations. No prompts, schemas or quality gates were weakened. The passing English result was preserved. Arabic resumed from 95 saved extractions and grouping at 80, completed grouping with Luna, then intelligence/angles with Terra. Egyptian reused valid Astra evidence/intelligence and regenerated only failed angles with Terra. No completed extraction was repeated.

Both runs completed ten angles and passed exact quotes, IDs, counts, evidence unions and deterministic scores. Both nevertheless **failed semantic closeout**: Egyptian retains an unsupported daily-use gift promise, overlapping comfort concepts and incomplete localization of labels/summaries; Arabic repeats a repurchase creative and proposes an unverified visual results timeline. Arabic prose is natural; Egyptian advertising prose is materially improved. No invented percentages/customer counts or seller/shipping leakage was found. See `TASKS.md` for the precise findings and retained stage provenance.

All 91 tests, typecheck, build, four browser workflows and fresh real Supabase auth/session/persistence validation passed. Public email confirmation remains separately user-confirmed. Secret-cache cleanup and the private-secret audit passed. Five genuine-resume operations used 70,796 reported tokens; Supabase added approximately five small operations. **Phase 2 is NOT DONE.** Changes remain local because commit/push was conditional on all quality gates passing. No Phase 3 work was started; reviews, credentials and validation artifacts remain ignored.

### Previous Phase 2 gate: deterministic guards and selective repair (2026-09-07)

The local implementation uses configurable FAST and QUALITY models, both set to `gpt-5.6-luna` for this validation. Optional `gpt-5.6-terra` FALLBACK is used only for a rejected item after one QUALITY repair. It is never automatically enabled by legacy configuration. Deterministic checks inspect selected evidence, scope, claim families, Arabic localization and angle similarity without paid judging calls. Every first-pass item is retained before repairs start; persistent failures are omitted. Intelligence and followups also undergo validation. The public evidence fields and deterministic score formula are unchanged. Safe internal telemetry records models, tokens, candidate outcomes and repair/drop counts without review text.

These lexical checks are **not a guarantee of semantic correctness**. The genuine validation found material gaps: a repaired Egyptian UGC concept invented a creator's product experience, and an initially accepted Arabic angle extended nail-serum evidence to eyelash use. Product scope alone does not identify which product supports a claim. Some benign sensory wording was wrongly classified as a visual-results claim, and several repaired Arabic concepts reused similar review-card execution.

Generation stopped on the material failure. Egyptian finished with five retained angles and clean mechanical evidence. Arabic intelligence finished; five partial angle candidates were recovered offline from saved responses after stopping its remaining repairs. Neither run passed semantic closeout. English's previous 96-review result is preserved; no extraction/grouping was repeated. Across the partial genuine attempt, 29 candidates yielded 11 first-pass acceptances, 16 QUALITY repairs, 12 fallback requests started (11 completed), five confirmed omissions and three unfinished candidates. Completed responses reported 131,871 tokens; interrupted and Supabase usage is additional and not fully available.

All 124 tests, typecheck, build, four browser workflows and real Supabase validation with the final configuration passed. Secret and customer-text audits are clean. **Phase 2 is NOT DONE.** Changes and private checkpoints remain saved locally, with no closeout commit/push or Phase 3 work. The next work requires addressing the demonstrated guardrail gaps, not another model escalation.
