/**
 * outage.fyi — Tests
 */

import { describe, it, expect } from "vitest";
import { normalizeIncident, deduplicateIncidents } from "../src/lib/normalizer/normalize";
import { computeScore, compareProviders } from "../src/lib/scoring/engine";
import { minutesBetween, windowToMs, parseInterval } from "../src/utils/time";
import type { Incident } from "../src/types/index";

// ─── Normalizer ──────────────────────────────────────────────────────────────

describe("Normalizer", () => {
  it("normalizes a basic incident", () => {
    const result = normalizeIncident({
      providerId: "vercel",
      externalId: "inc-123",
      title: "  Elevated error rates  ",
      startedAt: "2026-03-01T10:00:00Z",
      resolvedAt: "2026-03-01T11:30:00Z",
      severity: "major",
      status: "resolved",
    });

    expect(result.title).toBe("Elevated error rates");
    expect(result.severity).toBe("major");
    expect(result.status).toBe("resolved");
    expect(result.durationMinutes).toBe(90);
    expect(result.providerId).toBe("vercel");
  });

  it("defaults invalid severity to minor", () => {
    const result = normalizeIncident({
      providerId: "aws",
      externalId: "inc-456",
      title: "Test",
      startedAt: "2026-03-01T10:00:00Z",
      severity: "banana" as any,
    });
    expect(result.severity).toBe("minor");
  });

  it("defaults invalid status to investigating", () => {
    const result = normalizeIncident({
      providerId: "aws",
      externalId: "inc-789",
      title: "Test",
      startedAt: "2026-03-01T10:00:00Z",
      status: "unknown" as any,
    });
    expect(result.status).toBe("investigating");
  });

  it("computes duration from timestamps", () => {
    const result = normalizeIncident({
      providerId: "stripe",
      externalId: "inc-dur",
      title: "API latency",
      startedAt: "2026-03-01T10:00:00Z",
      resolvedAt: "2026-03-01T10:45:00Z",
    });
    expect(result.durationMinutes).toBe(45);
  });

  it("deduplicates by provider+externalId keeping newest", () => {
    const incidents: Incident[] = [
      {
        id: "a", providerId: "vercel", externalId: "inc-1", title: "Old",
        status: "investigating", severity: "minor", components: [],
        startedAt: "2026-03-01T10:00:00Z", resolvedAt: null, durationMinutes: null,
        url: null, updates: [], scrapedAt: "2026-03-01T10:05:00Z",
      },
      {
        id: "b", providerId: "vercel", externalId: "inc-1", title: "Updated",
        status: "resolved", severity: "minor", components: [],
        startedAt: "2026-03-01T10:00:00Z", resolvedAt: "2026-03-01T11:00:00Z", durationMinutes: 60,
        url: null, updates: [], scrapedAt: "2026-03-01T11:05:00Z",
      },
    ];

    const result = deduplicateIncidents(incidents);
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe("Updated");
    expect(result[0].status).toBe("resolved");
  });
});

// ─── Scoring ─────────────────────────────────────────────────────────────────

describe("Scoring Engine", () => {
  const makeIncident = (overrides: Partial<Incident> & { startedAt: string }): Incident => ({
    id: `inc-${Math.random()}`,
    providerId: "test",
    externalId: `ext-${Math.random()}`,
    title: "Test incident",
    status: "resolved",
    severity: "minor",
    components: [],
    resolvedAt: null,
    durationMinutes: null,
    url: null,
    updates: [],
    scrapedAt: new Date().toISOString(),
    ...overrides,
  });

  it("scores a provider with no incidents as 100", () => {
    const score = computeScore("perfect-provider", [], "30d");
    expect(score.score).toBe(100);
    expect(score.uptimePercent).toBe(100);
    expect(score.incidentCount).toBe(0);
  });

  it("reduces score for incidents", () => {
    const now = new Date();
    const recent = new Date(now.getTime() - 5 * 86400000).toISOString(); // 5 days ago

    const incidents = [
      makeIncident({ startedAt: recent, resolvedAt: new Date(new Date(recent).getTime() + 60 * 60000).toISOString(), durationMinutes: 60, severity: "major" }),
      makeIncident({ startedAt: recent, resolvedAt: new Date(new Date(recent).getTime() + 30 * 60000).toISOString(), durationMinutes: 30, severity: "minor" }),
    ];

    const score = computeScore("flaky-provider", incidents, "30d");
    expect(score.score).toBeLessThan(100);
    expect(score.incidentCount).toBe(2);
    expect(score.mttrMinutes).toBe(45); // (60+30)/2
  });

  it("compares two providers", () => {
    const scoreA = computeScore("good", [], "30d");
    const now = new Date();
    const recent = new Date(now.getTime() - 2 * 86400000).toISOString();
    const scoreB = computeScore("bad", [
      makeIncident({ startedAt: recent, durationMinutes: 120, severity: "critical" }),
    ], "30d");

    const comparison = compareProviders(scoreA, scoreB);
    expect(comparison.better).toBe("good");
    expect(comparison.scoreDiff).toBeGreaterThan(0);
  });
});

// ─── Time Utils ──────────────────────────────────────────────────────────────

describe("Time Utils", () => {
  it("computes minutes between timestamps", () => {
    expect(minutesBetween("2026-03-01T10:00:00Z", "2026-03-01T11:30:00Z")).toBe(90);
    expect(minutesBetween("2026-03-01T10:00:00Z", "2026-03-01T10:00:00Z")).toBe(0);
  });

  it("converts window strings to ms", () => {
    expect(windowToMs("7d")).toBe(7 * 86400000);
    expect(windowToMs("30d")).toBe(30 * 86400000);
    expect(windowToMs("1y")).toBe(365.25 * 86400000);
  });

  it("parses interval strings", () => {
    expect(parseInterval("5m")).toBe(300000);
    expect(parseInterval("1h")).toBe(3600000);
    expect(parseInterval("30s")).toBe(30000);
  });
});
