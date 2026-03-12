/**
 * outage.fyi — Reliability Scoring Engine
 *
 * Computes composite reliability scores from incident data.
 * Scores are 0-100 where 100 is perfect reliability.
 */

import type { Incident, ReliabilityScore, ScoringWindow, IncidentSeverity } from "../../types/index.js";
import { windowStart, nowISO } from "../../utils/time.js";

const SEVERITY_WEIGHTS: Record<IncidentSeverity, number> = {
  minor: 1,
  major: 3,
  critical: 10,
  maintenance: 0.5,
};

const WINDOW_MINUTES: Record<ScoringWindow, number> = {
  "7d": 7 * 24 * 60,
  "30d": 30 * 24 * 60,
  "90d": 90 * 24 * 60,
  "1y": 365 * 24 * 60,
};

export function computeScore(
  providerId: string,
  incidents: Incident[],
  window: ScoringWindow = "90d",
): ReliabilityScore {
  const since = windowStart(window);
  const windowIncidents = incidents.filter(
    (i) => i.startedAt >= since && i.severity !== "maintenance",
  );
  const allWindowIncidents = incidents.filter((i) => i.startedAt >= since);

  const totalMinutes = WINDOW_MINUTES[window];

  // Uptime: total minutes minus incident duration
  const downtimeMinutes = windowIncidents.reduce((sum, i) => sum + (i.durationMinutes || 0), 0);
  const uptimePercent = Math.max(0, Math.min(100, ((totalMinutes - downtimeMinutes) / totalMinutes) * 100));

  // MTTR: mean time to resolution
  const resolved = windowIncidents.filter((i) => i.durationMinutes !== null && i.durationMinutes > 0);
  const mttrMinutes = resolved.length > 0
    ? resolved.reduce((sum, i) => sum + (i.durationMinutes || 0), 0) / resolved.length
    : 0;

  // Severity distribution
  const severityDistribution: Record<IncidentSeverity, number> = { minor: 0, major: 0, critical: 0, maintenance: 0 };
  for (const inc of allWindowIncidents) {
    severityDistribution[inc.severity]++;
  }

  // Average response time (time from incident start to first update)
  const responseTimes: number[] = [];
  for (const inc of windowIncidents) {
    if (inc.updates.length > 0) {
      const firstUpdate = new Date(inc.updates[inc.updates.length - 1].createdAt).getTime();
      const start = new Date(inc.startedAt).getTime();
      const diffMin = (firstUpdate - start) / 60000;
      if (diffMin >= 0) responseTimes.push(diffMin);
    }
  }
  const avgResponseMinutes = responseTimes.length > 0
    ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
    : 0;

  // Composite score (0-100)
  // Weighted: uptime 40%, incident frequency 25%, MTTR 20%, response speed 15%
  const uptimeScore = uptimePercent; // already 0-100
  const frequencyScore = Math.max(0, 100 - windowIncidents.length * 5); // -5 per incident
  const mttrScore = mttrMinutes === 0 ? 100 : Math.max(0, 100 - (mttrMinutes / 10)); // -1 per 10min
  const responseScore = avgResponseMinutes === 0 ? 100 : Math.max(0, 100 - (avgResponseMinutes / 5)); // -1 per 5min

  const score = Math.round(
    uptimeScore * 0.4 +
    frequencyScore * 0.25 +
    mttrScore * 0.2 +
    responseScore * 0.15
  );

  return {
    providerId,
    window,
    computedAt: nowISO(),
    uptimePercent: Math.round(uptimePercent * 10000) / 10000,
    mttrMinutes: Math.round(mttrMinutes * 100) / 100,
    incidentCount: allWindowIncidents.length,
    severityDistribution,
    avgResponseMinutes: Math.round(avgResponseMinutes * 100) / 100,
    score: Math.max(0, Math.min(100, score)),
  };
}

export function compareProviders(
  scoreA: ReliabilityScore,
  scoreB: ReliabilityScore,
): {
  better: string;
  scoreDiff: number;
  uptimeDiff: number;
  mttrDiff: number;
  summary: string;
} {
  const better = scoreA.score >= scoreB.score ? scoreA.providerId : scoreB.providerId;
  const scoreDiff = Math.abs(scoreA.score - scoreB.score);
  const uptimeDiff = Math.abs(scoreA.uptimePercent - scoreB.uptimePercent);
  const mttrDiff = scoreA.mttrMinutes - scoreB.mttrMinutes;

  let summary: string;
  if (scoreDiff < 3) {
    summary = `${scoreA.providerId} and ${scoreB.providerId} are roughly equivalent in reliability.`;
  } else {
    summary = `${better} scores ${scoreDiff} points higher over this window.`;
  }

  return { better, scoreDiff, uptimeDiff, mttrDiff, summary };
}
