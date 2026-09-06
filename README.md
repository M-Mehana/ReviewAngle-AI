# ReviewAngle AI

An evidence-first customer research workspace. Import reviews, extract customer insights in bounded stages, inspect the original evidence behind every angle, generate grounded follow-ups, and export the results. English and Arabic interface; English, Modern Standard Arabic, Egyptian and Gulf/Saudi marketing output.

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
4. Set `OPENAI_API_KEY` to a project-scoped key and `OPENAI_MODEL` to a Responses structured-output model available to that account. The documented default is `gpt-6-astra`; the model is configurable. Set a spending limit in your OpenAI account.
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

| Variable                        | Purpose                                                                  |
| ------------------------------- | ------------------------------------------------------------------------ |
| `NEXT_PUBLIC_SUPABASE_URL`      | Supabase project URL, compiled into the client                           |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public auth client key, compiled into the client                         |
| `SUPABASE_SERVICE_ROLE_KEY`     | Server-only database access; verified owner filtering on every operation |
| `OPENAI_API_KEY`                | Server-only Responses API key                                            |
| `OPENAI_MODEL`                  | Structured-output model; defaults to `gpt-6-astra`                       |
| `DEMO_MODE`                     | Explicit localhost synthetic mode, never enabled in production           |
| `NEXT_PUBLIC_DEMO_MODE`         | Reserved public demo flag; server remains authoritative                  |
| `APP_ORIGIN`                    | Trusted app origin for browser mutations and deployment                  |
| `FREE_REVIEW_LIMIT`             | Monthly review allowance, default 500; full batch reserved once per run  |
| `MAX_REVIEWS_PER_PROJECT`       | Server cap, default 200; UI currently also caps at 200                   |
| `FREE_FOLLOWUP_LIMIT`           | Monthly follow-up/translation attempt allowance, default 30              |
| `URL_SUPPORTED_DOMAINS`         | Comma-separated explicitly permitted domains, including their subdomains |
| `URL_DISABLED_DOMAINS`          | Explicitly disabled domains; overrides supported policy                  |

All optional limits must be positive integers. URL imports have a monthly allowance of 20 attempts. Authenticated API requests have a database-backed rolling limit of 120 requests per minute per user. Failed paid requests can still consume provider resources; review reservations and follow-up attempts are not automatically refunded. Reopening/resuming the same run does not charge the review allowance again.

## Workflow and limits

- **Paste:** one review per paragraph, with a blank line between reviews.
- **Files:** CSV with a header row and flexible text/rating/date/title mapping; TXT uses paragraph separation. UTF-8 and UTF-8 BOM supported; quoted multiline CSV supported. XLSX is intentionally deferred: export it as CSV.
- **Preview:** shows usable rows, exact duplicates, near duplicates and rejected rows. Only review text is mandatory. Ratings outside 1–5 are ignored. Date strings remain source text so ambiguous locale dates are not silently reinterpreted.
- **Processing:** maximum 2 MB input, 200 reviews per project, 6,000 normalized characters per review. Long rows are reported, never silently truncated. HTML and invisible direction controls are removed from model input; originals remain intact in evidence. Language detection is a deterministic Arabic/Latin-script heuristic, not a multilingual language classifier.
- **Pipeline:** extraction batches of six; theme canonicalization batches of ten extracted reviews, reusing previous labels; deterministic unique-review counts; exact phrase counting; intelligence and angles from the top 80 themes with up to two verified excerpts each. All themes remain visible even when not included in generation. No full large review collection goes into a single prompt. Around ten angles are requested, with fewer when evidence is insufficient (seven in the fixture example).
- **Recovery:** each request advances and persists one stage/batch. If the tab closes or the service fails, reopen the project and resume. Omitted review records are flagged and excluded from analysis counts. Retry missing reviews rebuilds derived insights, angles and follow-ups; original reviews keep their IDs. A crashed server's processing lease expires after ten minutes.
- **Evidence:** quote text must be an exact substring of the masked normalized review. Invalid quoted facts are discarded; unknown IDs fail the stage. Themes/insights/angles use server-derived ID links. An LLM can still misinterpret a real quote, so inspect originals before using marketing claims.
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

Before public launch, validate actual Supabase email delivery/session refresh and a real paid OpenAI run in a staging account. These were not live-tested here because service credentials were absent. Review your privacy/retention policy, configure edge request limits and monitoring, and verify permitted source domains. The app deliberately does not deploy itself or provision paid services.

## References

- [OpenAI Responses structured outputs](https://developers.openai.com/api/docs/guides/structured-outputs)
- [Next.js installation](https://nextjs.org/docs/app/getting-started/installation)
- [Supabase email passwordless auth](https://supabase.com/docs/guides/auth/auth-email-passwordless)
- [Supabase row-level security](https://supabase.com/docs/guides/database/postgres/row-level-security)

See `TASKS.md` for implementation and validation status, and `ARCHITECTURE.md` for boundaries and scoring.
