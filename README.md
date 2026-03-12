# outage.fyi

**Real uptime data for every cloud service.**

outage.fyi scrapes, normalizes, and scores every public status page, incident report, and downtime event across cloud providers, SaaS tools, and APIs. Query actual reliability — not marketing pages.

## Why

Every provider claims 99.99% uptime. Nobody tracks what actually happens. outage.fyi does. We crawl hundreds of status pages on a schedule, normalize the incidents into a common schema, and compute reliability scores from real data. The result is a searchable, queryable dataset of every outage across the cloud ecosystem — with history going back to the first day we started watching.

## Quick Start

```bash
bun install
cp .env.example .env

# Run a one-off scrape of all providers
bun run bin/scrape.ts

# Start the API server
bun run bin/serve.ts

# Start the continuous scraper (cron mode)
bun run bin/scrape.ts --daemon --interval 5m

# Query reliability
curl http://localhost:3000/v1/score/vercel
curl http://localhost:3000/v1/incidents?provider=aws&since=2026-01-01
curl http://localhost:3000/v1/compare?a=netlify&b=vercel&window=90d
```

## How It Works

```
Status pages (hundreds)
    → Scrapers pull current + historical incidents
    → Normalizer converts to common schema
    → Scoring engine computes reliability metrics
    → SQLite stores everything locally
    → API serves queries over HTTP
```

### Scraping

Each provider has a scraper adapter. Most cloud services use one of a few status page platforms (Atlassian Statuspage, Instatus, Cachet, custom). We detect the platform and use the right parser. Raw HTML is never stored — only normalized incident data.

### Normalization

Every incident becomes a standard record:

```typescript
{
  provider: "vercel",
  id: "inc-2026-03-08-deploy",
  title: "Elevated error rates on deployments",
  status: "resolved",
  severity: "major",
  components: ["deployments", "edge-network"],
  startedAt: "2026-03-08T14:22:00Z",
  resolvedAt: "2026-03-08T15:47:00Z",
  durationMinutes: 85,
  updates: [ ... ]
}
```

### Scoring

Reliability scores are computed from real incident data over configurable windows (7d, 30d, 90d, 1y):

- **Uptime %** — Actual availability based on incident duration vs total time
- **MTTR** — Mean time to resolution across all incidents
- **Incident frequency** — How often things break
- **Severity distribution** — Ratio of major/minor/maintenance events
- **Response speed** — Time from incident start to first status update

## Provider Coverage

outage.fyi ships with adapters for major providers out of the box. Adding a new provider is a single file.

| Category | Providers |
|----------|-----------|
| Cloud | AWS, GCP, Azure, DigitalOcean, Hetzner, OVH |
| Hosting | Vercel, Netlify, Cloudflare, Fly.io, Railway, Render |
| Databases | PlanetScale, Supabase, Neon, MongoDB Atlas, Redis Cloud |
| Auth | Auth0, Clerk, Firebase Auth, Supabase Auth |
| Payments | Stripe, Braintree, Square |
| Messaging | Twilio, SendGrid, Postmark, Resend |
| Monitoring | Datadog, New Relic, Sentry, PagerDuty |
| Dev Tools | GitHub, GitLab, Bitbucket, npm, Docker Hub |
| AI/ML | OpenAI, Anthropic, Replicate, Hugging Face |

## API Reference

```
GET /v1/providers                         List all tracked providers
GET /v1/providers/:id                     Provider details + current status

GET /v1/incidents                         List incidents (filterable)
    ?provider=aws                         Filter by provider
    ?severity=major                       Filter by severity
    ?since=2026-01-01                     Filter by start date
    ?until=2026-03-01                     Filter by end date
    ?component=api                        Filter by affected component
    ?limit=50&offset=0                    Pagination

GET /v1/score/:provider                   Reliability score
    ?window=90d                           Scoring window (7d, 30d, 90d, 1y)

GET /v1/compare                           Compare two providers
    ?a=vercel&b=netlify                   Provider slugs
    ?window=90d                           Scoring window

GET /v1/timeline/:provider                Incident timeline
    ?since=2026-01-01                     Start date
    ?granularity=day                      day | week | month

GET /v1/status                            Current status of all providers
GET /v1/health                            API health check
```

## CLI

```bash
# Scraping
bun run bin/scrape.ts                         # Scrape all providers once
bun run bin/scrape.ts --provider vercel       # Scrape a single provider
bun run bin/scrape.ts --daemon --interval 5m  # Run continuously
bun run bin/scrape.ts --backfill              # Backfill historical data

# Server
bun run bin/serve.ts                          # Start API on :3000
bun run bin/serve.ts --port 8080              # Custom port

# Utilities
bun run bin/score.ts --provider aws           # Recompute scores
bun run bin/score.ts --all                    # Recompute all scores
bun run bin/export.ts --format json           # Export full dataset
bun run bin/export.ts --format csv            # Export as CSV
```

## Adding a Provider

Create a file in `src/lib/scrapers/`:

```typescript
import type { ScraperAdapter } from "../../types/index.js";

export const myProvider: ScraperAdapter = {
  id: "my-provider",
  name: "My Provider",
  url: "https://status.myprovider.com",
  platform: "statuspage", // statuspage | instatus | custom
  async scrape(ctx) {
    // Fetch and parse the status page
    // Return normalized incidents
  },
};
```

Register it in `src/lib/scrapers/registry.ts` and it's live on the next scrape cycle.

## Project Structure

```
outage-fyi/
├── bin/
│   ├── scrape.ts                 # Scraper CLI + daemon
│   ├── serve.ts                  # API server entrypoint
│   ├── score.ts                  # Score recomputation
│   └── export.ts                 # Dataset export
├── src/
│   ├── config/
│   │   └── index.ts              # App configuration
│   ├── types/
│   │   └── index.ts              # Shared type definitions
│   ├── lib/
│   │   ├── scrapers/
│   │   │   ├── registry.ts       # Provider scraper registry
│   │   │   ├── statuspage.ts     # Atlassian Statuspage adapter
│   │   │   ├── instatus.ts       # Instatus adapter
│   │   │   └── custom.ts         # Custom status page adapter
│   │   ├── normalizer/
│   │   │   └── normalize.ts      # Raw → common schema
│   │   ├── scoring/
│   │   │   └── engine.ts         # Reliability score computation
│   │   └── storage/
│   │       └── db.ts             # SQLite persistence
│   ├── api/
│   │   ├── server.ts             # HTTP server
│   │   └── routes.ts             # API route handlers
│   └── utils/
│       ├── logger.ts             # Structured logging
│       ├── http.ts               # HTTP fetch helpers
│       └── time.ts               # Time/duration utilities
├── data/
│   └── providers/
│       └── providers.json        # Provider registry
├── test/
│   ├── normalizer.test.ts        # Normalization tests
│   └── scoring.test.ts           # Scoring engine tests
├── .github/
│   └── workflows/
│       └── ci.yml                # CI pipeline
├── .env.example
├── .gitignore
├── LICENSE
├── README.md
├── package.json
├── tsconfig.json
└── vitest.config.ts
```

## Environment Variables

```bash
# Optional
OUTAGE_DB_PATH=.outage-fyi/outage.db     # SQLite database location
OUTAGE_SCRAPE_INTERVAL=300                 # Seconds between scrape cycles
OUTAGE_LOG_LEVEL=info                      # debug | info | warn | error
OUTAGE_API_PORT=3000                       # API server port
OUTAGE_USER_AGENT=outage.fyi/0.1          # Scraper user agent
```

## Development

```bash
bun install
bun run test
bun run typecheck
bun run lint
```

## License

MIT
