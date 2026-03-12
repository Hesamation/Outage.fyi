/**
 * outage.fyi — Provider Scraper Registry
 */

import type { Provider, ScrapeContext, ScrapeResult } from "../../types/index.js";
import { scrapeStatuspage } from "./statuspage.js";

type ScrapeFunction = (ctx: ScrapeContext) => Promise<ScrapeResult>;

const PLATFORM_SCRAPERS: Record<string, ScrapeFunction> = {
  statuspage: scrapeStatuspage,
  // instatus: scrapeInstatus,  // TODO
  // cachet: scrapeCachet,      // TODO
  // custom: scrapeCustom,      // TODO
};

// ─── Provider Definitions ────────────────────────────────────────────────────

export const PROVIDERS: Provider[] = [
  // Cloud
  { id: "aws", name: "Amazon Web Services", url: "https://aws.amazon.com", statusUrl: "https://health.aws.amazon.com", platform: "custom", category: "cloud", components: ["ec2", "s3", "lambda", "rds", "cloudfront"] },
  { id: "gcp", name: "Google Cloud Platform", url: "https://cloud.google.com", statusUrl: "https://status.cloud.google.com", platform: "custom", category: "cloud", components: ["compute", "storage", "bigquery", "cloud-run"] },
  { id: "azure", name: "Microsoft Azure", url: "https://azure.microsoft.com", statusUrl: "https://status.azure.com", platform: "custom", category: "cloud", components: ["vm", "storage", "sql", "functions"] },
  { id: "digitalocean", name: "DigitalOcean", url: "https://digitalocean.com", statusUrl: "https://status.digitalocean.com", platform: "statuspage", category: "cloud", components: ["droplets", "spaces", "kubernetes", "databases"] },

  // Hosting
  { id: "vercel", name: "Vercel", url: "https://vercel.com", statusUrl: "https://www.vercel-status.com", platform: "statuspage", category: "hosting", components: ["deployments", "edge-network", "serverless-functions", "dns"] },
  { id: "netlify", name: "Netlify", url: "https://netlify.com", statusUrl: "https://www.netlifystatus.com", platform: "statuspage", category: "hosting", components: ["builds", "cdn", "functions", "dns"] },
  { id: "cloudflare", name: "Cloudflare", url: "https://cloudflare.com", statusUrl: "https://www.cloudflarestatus.com", platform: "statuspage", category: "hosting", components: ["cdn", "dns", "workers", "r2", "pages"] },
  { id: "fly", name: "Fly.io", url: "https://fly.io", statusUrl: "https://status.flyio.net", platform: "statuspage", category: "hosting", components: ["machines", "networking", "volumes"] },
  { id: "railway", name: "Railway", url: "https://railway.app", statusUrl: "https://status.railway.app", platform: "instatus", category: "hosting", components: ["deployments", "networking", "databases"] },
  { id: "render", name: "Render", url: "https://render.com", statusUrl: "https://status.render.com", platform: "statuspage", category: "hosting", components: ["web-services", "databases", "cron-jobs"] },

  // Databases
  { id: "supabase", name: "Supabase", url: "https://supabase.com", statusUrl: "https://status.supabase.com", platform: "statuspage", category: "database", components: ["database", "auth", "storage", "edge-functions", "realtime"] },
  { id: "planetscale", name: "PlanetScale", url: "https://planetscale.com", statusUrl: "https://www.planetscalestatus.com", platform: "statuspage", category: "database", components: ["database", "api", "branching"] },
  { id: "neon", name: "Neon", url: "https://neon.tech", statusUrl: "https://neonstatus.com", platform: "statuspage", category: "database", components: ["compute", "storage", "api"] },
  { id: "mongodb-atlas", name: "MongoDB Atlas", url: "https://mongodb.com/atlas", statusUrl: "https://status.cloud.mongodb.com", platform: "statuspage", category: "database", components: ["clusters", "data-api", "search"] },

  // Auth
  { id: "clerk", name: "Clerk", url: "https://clerk.com", statusUrl: "https://status.clerk.com", platform: "statuspage", category: "auth", components: ["authentication", "api", "dashboard"] },
  { id: "auth0", name: "Auth0", url: "https://auth0.com", statusUrl: "https://status.auth0.com", platform: "statuspage", category: "auth", components: ["authentication", "management-api"] },

  // Payments
  { id: "stripe", name: "Stripe", url: "https://stripe.com", statusUrl: "https://status.stripe.com", platform: "statuspage", category: "payments", components: ["api", "dashboard", "checkout", "connect"] },

  // Messaging
  { id: "twilio", name: "Twilio", url: "https://twilio.com", statusUrl: "https://status.twilio.com", platform: "statuspage", category: "messaging", components: ["sms", "voice", "api"] },
  { id: "resend", name: "Resend", url: "https://resend.com", statusUrl: "https://status.resend.com", platform: "statuspage", category: "messaging", components: ["api", "smtp", "webhooks"] },
  { id: "sendgrid", name: "SendGrid", url: "https://sendgrid.com", statusUrl: "https://status.sendgrid.com", platform: "statuspage", category: "messaging", components: ["api", "smtp", "webhooks"] },

  // Monitoring
  { id: "datadog", name: "Datadog", url: "https://datadoghq.com", statusUrl: "https://status.datadoghq.com", platform: "statuspage", category: "monitoring", components: ["metrics", "logs", "apm", "synthetics"] },
  { id: "sentry", name: "Sentry", url: "https://sentry.io", statusUrl: "https://status.sentry.io", platform: "statuspage", category: "monitoring", components: ["event-processing", "api", "dashboard"] },

  // Dev Tools
  { id: "github", name: "GitHub", url: "https://github.com", statusUrl: "https://www.githubstatus.com", platform: "statuspage", category: "devtools", components: ["git-operations", "api", "actions", "pages", "packages"] },
  { id: "gitlab", name: "GitLab", url: "https://gitlab.com", statusUrl: "https://status.gitlab.com", platform: "statuspage", category: "devtools", components: ["git", "ci-cd", "api", "registry"] },
  { id: "npm", name: "npm", url: "https://npmjs.com", statusUrl: "https://status.npmjs.org", platform: "statuspage", category: "devtools", components: ["registry", "website", "cli"] },
  { id: "docker-hub", name: "Docker Hub", url: "https://hub.docker.com", statusUrl: "https://www.dockerstatus.com", platform: "statuspage", category: "devtools", components: ["registry", "builds", "api"] },

  // AI/ML
  { id: "openai", name: "OpenAI", url: "https://openai.com", statusUrl: "https://status.openai.com", platform: "statuspage", category: "ai", components: ["api", "chatgpt", "dall-e", "playground"] },
  { id: "anthropic", name: "Anthropic", url: "https://anthropic.com", statusUrl: "https://status.anthropic.com", platform: "statuspage", category: "ai", components: ["api", "claude", "console"] },
  { id: "replicate", name: "Replicate", url: "https://replicate.com", statusUrl: "https://status.replicate.com", platform: "statuspage", category: "ai", components: ["api", "predictions", "models"] },
];

// ─── Registry Functions ──────────────────────────────────────────────────────

export function getProvider(id: string): Provider | undefined {
  return PROVIDERS.find((p) => p.id === id);
}

export function listProviders(category?: string): Provider[] {
  if (category) return PROVIDERS.filter((p) => p.category === category);
  return PROVIDERS;
}

export function getScraperForProvider(provider: Provider): ScrapeFunction | null {
  return PLATFORM_SCRAPERS[provider.platform] || null;
}
