/**
 * outage.fyi — Incident Normalizer
 *
 * Ensures all incidents from different scraper adapters conform
 * to the same schema with consistent severity/status values.
 */

import type { Incident, IncidentSeverity, IncidentStatus } from "../../types/index.js";
import { minutesBetween } from "../../utils/time.js";

const VALID_SEVERITIES: Set<IncidentSeverity> = new Set(["minor", "major", "critical", "maintenance"]);
const VALID_STATUSES: Set<IncidentStatus> = new Set(["investigating", "identified", "monitoring", "resolved", "postmortem"]);

export function normalizeIncident(raw: Partial<Incident> & { providerId: string; externalId: string; title: string; startedAt: string }): Incident {
  const severity: IncidentSeverity = VALID_SEVERITIES.has(raw.severity as IncidentSeverity) ? raw.severity as IncidentSeverity : "minor";
  const status: IncidentStatus = VALID_STATUSES.has(raw.status as IncidentStatus) ? raw.status as IncidentStatus : "investigating";

  let durationMinutes = raw.durationMinutes ?? null;
  if (durationMinutes === null && raw.resolvedAt) {
    durationMinutes = minutesBetween(raw.startedAt, raw.resolvedAt);
  }

  return {
    id: raw.id || `${raw.providerId}-${raw.externalId}`,
    providerId: raw.providerId,
    externalId: raw.externalId,
    title: raw.title.trim(),
    status,
    severity,
    components: raw.components || [],
    startedAt: raw.startedAt,
    resolvedAt: raw.resolvedAt || null,
    durationMinutes,
    url: raw.url || null,
    updates: (raw.updates || []).map((u) => ({
      status: VALID_STATUSES.has(u.status) ? u.status : "investigating",
      body: u.body.trim(),
      createdAt: u.createdAt,
    })),
    scrapedAt: raw.scrapedAt || new Date().toISOString(),
  };
}

export function deduplicateIncidents(incidents: Incident[]): Incident[] {
  const seen = new Map<string, Incident>();
  for (const inc of incidents) {
    const key = `${inc.providerId}:${inc.externalId}`;
    const existing = seen.get(key);
    if (!existing || new Date(inc.scrapedAt) > new Date(existing.scrapedAt)) {
      seen.set(key, inc);
    }
  }
  return Array.from(seen.values());
}
