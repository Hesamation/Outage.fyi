/**
 * outage.fyi — Atlassian Statuspage Scraper
 *
 * Parses the JSON API that Atlassian Statuspage exposes at
 * /api/v2/incidents.json and /api/v2/status.json.
 * Used by: Vercel, Netlify, Stripe, Twilio, Datadog, GitHub, npm, etc.
 */

import type { ScrapeContext, ScrapeResult, Incident, IncidentSeverity, IncidentStatus } from "../../types/index.js";
import { fetchJson } from "../../utils/http.js";
import { minutesBetween, nowISO } from "../../utils/time.js";
import * as crypto from "crypto";

interface StatuspageIncident {
  id: string;
  name: string;
  status: string;
  impact: string;
  created_at: string;
  resolved_at: string | null;
  shortlink: string;
  components: Array<{ name: string }>;
  incident_updates: Array<{
    status: string;
    body: string;
    created_at: string;
  }>;
}

interface StatuspageStatus {
  status: { indicator: string; description: string };
}

const SEVERITY_MAP: Record<string, IncidentSeverity> = {
  none: "minor",
  minor: "minor",
  major: "major",
  critical: "critical",
  maintenance: "maintenance",
};

const STATUS_MAP: Record<string, IncidentStatus> = {
  investigating: "investigating",
  identified: "identified",
  monitoring: "monitoring",
  resolved: "resolved",
  postmortem: "postmortem",
  scheduled: "investigating",
  in_progress: "identified",
  verifying: "monitoring",
  completed: "resolved",
};

const CURRENT_STATUS_MAP: Record<string, ScrapeResult["currentStatus"]> = {
  none: "operational",
  minor: "degraded",
  major: "partial_outage",
  critical: "major_outage",
  maintenance: "maintenance",
};

export async function scrapeStatuspage(ctx: ScrapeContext): Promise<ScrapeResult> {
  const { provider, logger } = ctx;
  const baseUrl = provider.statusUrl.replace(/\/$/, "");
  const start = performance.now();

  try {
    // Fetch current status
    const statusData = await fetchJson<StatuspageStatus>(
      `${baseUrl}/api/v2/status.json`,
      { userAgent: ctx.userAgent, logger },
    );

    // Fetch incidents (returns most recent ~50)
    const incidentData = await fetchJson<{ incidents: StatuspageIncident[] }>(
      `${baseUrl}/api/v2/incidents.json`,
      { userAgent: ctx.userAgent, logger },
    );

    const now = nowISO();
    const incidents: Incident[] = incidentData.incidents.map((raw) => {
      const severity = SEVERITY_MAP[raw.impact] || "minor";
      const status = STATUS_MAP[raw.status] || "investigating";
      const duration = raw.resolved_at ? minutesBetween(raw.created_at, raw.resolved_at) : null;

      return {
        id: crypto.createHash("sha256").update(`${provider.id}:${raw.id}`).digest("hex").slice(0, 16),
        providerId: provider.id,
        externalId: raw.id,
        title: raw.name,
        status,
        severity,
        components: raw.components.map((c) => c.name),
        startedAt: raw.created_at,
        resolvedAt: raw.resolved_at,
        durationMinutes: duration,
        url: raw.shortlink || null,
        updates: raw.incident_updates.map((u) => ({
          status: STATUS_MAP[u.status] || "investigating",
          body: u.body,
          createdAt: u.created_at,
        })),
        scrapedAt: now,
      };
    });

    logger.info(`Scraped ${provider.name}: ${incidents.length} incidents`);

    return {
      providerId: provider.id,
      incidents,
      currentStatus: CURRENT_STATUS_MAP[statusData.status.indicator] || "operational",
      scrapedAt: now,
      durationMs: Math.round(performance.now() - start),
    };
  } catch (err: any) {
    logger.error(`Failed to scrape ${provider.name}: ${err.message}`);
    return {
      providerId: provider.id,
      incidents: [],
      currentStatus: "operational",
      scrapedAt: nowISO(),
      durationMs: Math.round(performance.now() - start),
      error: err.message,
    };
  }
}
