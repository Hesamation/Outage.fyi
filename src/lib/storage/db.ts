/**
 * outage.fyi — SQLite Storage
 *
 * Persistence layer for incidents, scores, and provider state.
 * Uses better-sqlite3 for synchronous, fast local storage.
 */

import Database from "better-sqlite3";
import * as fs from "fs";
import * as path from "path";
import type { Incident, ReliabilityScore, ScrapeResult } from "../../types/index.js";
import { createLogger } from "../../utils/logger.js";

const log = createLogger("storage");

export class OutageDB {
  private db: Database.Database;

  constructor(dbPath: string) {
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    this.db = new Database(dbPath);
    this.db.pragma("journal_mode = WAL");
    this.db.pragma("foreign_keys = ON");
    this.migrate();
    log.info(`Database opened: ${dbPath}`);
  }

  private migrate(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS incidents (
        id TEXT PRIMARY KEY,
        provider_id TEXT NOT NULL,
        external_id TEXT NOT NULL,
        title TEXT NOT NULL,
        status TEXT NOT NULL,
        severity TEXT NOT NULL,
        components TEXT NOT NULL DEFAULT '[]',
        started_at TEXT NOT NULL,
        resolved_at TEXT,
        duration_minutes INTEGER,
        url TEXT,
        updates TEXT NOT NULL DEFAULT '[]',
        scraped_at TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        UNIQUE(provider_id, external_id)
      );

      CREATE INDEX IF NOT EXISTS idx_incidents_provider ON incidents(provider_id);
      CREATE INDEX IF NOT EXISTS idx_incidents_started ON incidents(started_at);
      CREATE INDEX IF NOT EXISTS idx_incidents_severity ON incidents(severity);

      CREATE TABLE IF NOT EXISTS scores (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        provider_id TEXT NOT NULL,
        window TEXT NOT NULL,
        computed_at TEXT NOT NULL,
        uptime_percent REAL NOT NULL,
        mttr_minutes REAL NOT NULL,
        incident_count INTEGER NOT NULL,
        severity_distribution TEXT NOT NULL DEFAULT '{}',
        avg_response_minutes REAL NOT NULL,
        score REAL NOT NULL,
        UNIQUE(provider_id, window)
      );

      CREATE TABLE IF NOT EXISTS scrape_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        provider_id TEXT NOT NULL,
        status TEXT NOT NULL,
        current_status TEXT,
        incident_count INTEGER NOT NULL DEFAULT 0,
        duration_ms INTEGER NOT NULL,
        error TEXT,
        scraped_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_scrape_log_provider ON scrape_log(provider_id);
    `);
  }

  // ─── Incidents ───────────────────────────────────────────────────────

  upsertIncident(incident: Incident): void {
    const stmt = this.db.prepare(`
      INSERT INTO incidents (id, provider_id, external_id, title, status, severity, components, started_at, resolved_at, duration_minutes, url, updates, scraped_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(provider_id, external_id) DO UPDATE SET
        title = excluded.title,
        status = excluded.status,
        severity = excluded.severity,
        components = excluded.components,
        resolved_at = excluded.resolved_at,
        duration_minutes = excluded.duration_minutes,
        updates = excluded.updates,
        scraped_at = excluded.scraped_at
    `);

    stmt.run(
      incident.id,
      incident.providerId,
      incident.externalId,
      incident.title,
      incident.status,
      incident.severity,
      JSON.stringify(incident.components),
      incident.startedAt,
      incident.resolvedAt,
      incident.durationMinutes,
      incident.url,
      JSON.stringify(incident.updates),
      incident.scrapedAt,
    );
  }

  upsertIncidents(incidents: Incident[]): void {
    const tx = this.db.transaction(() => {
      for (const inc of incidents) this.upsertIncident(inc);
    });
    tx();
  }

  queryIncidents(filter: {
    providerId?: string;
    severity?: string;
    since?: string;
    until?: string;
    component?: string;
    limit?: number;
    offset?: number;
  }): { data: Incident[]; total: number } {
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (filter.providerId) { conditions.push("provider_id = ?"); params.push(filter.providerId); }
    if (filter.severity) { conditions.push("severity = ?"); params.push(filter.severity); }
    if (filter.since) { conditions.push("started_at >= ?"); params.push(filter.since); }
    if (filter.until) { conditions.push("started_at <= ?"); params.push(filter.until); }
    if (filter.component) { conditions.push("components LIKE ?"); params.push(`%${filter.component}%`); }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    const limit = filter.limit || 50;
    const offset = filter.offset || 0;

    const countRow = this.db.prepare(`SELECT COUNT(*) as count FROM incidents ${where}`).get(...params) as { count: number };
    const rows = this.db.prepare(`SELECT * FROM incidents ${where} ORDER BY started_at DESC LIMIT ? OFFSET ?`).all(...params, limit, offset) as any[];

    return {
      total: countRow.count,
      data: rows.map(this.rowToIncident),
    };
  }

  getIncidentsByProvider(providerId: string, since?: string): Incident[] {
    const query = since
      ? this.db.prepare("SELECT * FROM incidents WHERE provider_id = ? AND started_at >= ? ORDER BY started_at DESC")
      : this.db.prepare("SELECT * FROM incidents WHERE provider_id = ? ORDER BY started_at DESC");

    const rows = since ? query.all(providerId, since) : query.all(providerId);
    return (rows as any[]).map(this.rowToIncident);
  }

  private rowToIncident(row: any): Incident {
    return {
      id: row.id,
      providerId: row.provider_id,
      externalId: row.external_id,
      title: row.title,
      status: row.status,
      severity: row.severity,
      components: JSON.parse(row.components),
      startedAt: row.started_at,
      resolvedAt: row.resolved_at,
      durationMinutes: row.duration_minutes,
      url: row.url,
      updates: JSON.parse(row.updates),
      scrapedAt: row.scraped_at,
    };
  }

  // ─── Scores ──────────────────────────────────────────────────────────

  upsertScore(score: ReliabilityScore): void {
    this.db.prepare(`
      INSERT INTO scores (provider_id, window, computed_at, uptime_percent, mttr_minutes, incident_count, severity_distribution, avg_response_minutes, score)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(provider_id, window) DO UPDATE SET
        computed_at = excluded.computed_at,
        uptime_percent = excluded.uptime_percent,
        mttr_minutes = excluded.mttr_minutes,
        incident_count = excluded.incident_count,
        severity_distribution = excluded.severity_distribution,
        avg_response_minutes = excluded.avg_response_minutes,
        score = excluded.score
    `).run(
      score.providerId,
      score.window,
      score.computedAt,
      score.uptimePercent,
      score.mttrMinutes,
      score.incidentCount,
      JSON.stringify(score.severityDistribution),
      score.avgResponseMinutes,
      score.score,
    );
  }

  getScore(providerId: string, window: string): ReliabilityScore | null {
    const row = this.db.prepare("SELECT * FROM scores WHERE provider_id = ? AND window = ?").get(providerId, window) as any;
    if (!row) return null;
    return {
      providerId: row.provider_id,
      window: row.window,
      computedAt: row.computed_at,
      uptimePercent: row.uptime_percent,
      mttrMinutes: row.mttr_minutes,
      incidentCount: row.incident_count,
      severityDistribution: JSON.parse(row.severity_distribution),
      avgResponseMinutes: row.avg_response_minutes,
      score: row.score,
    };
  }

  // ─── Scrape Log ──────────────────────────────────────────────────────

  logScrape(result: ScrapeResult): void {
    this.db.prepare(`
      INSERT INTO scrape_log (provider_id, status, current_status, incident_count, duration_ms, error, scraped_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      result.providerId,
      result.error ? "error" : "ok",
      result.currentStatus,
      result.incidents.length,
      result.durationMs,
      result.error || null,
      result.scrapedAt,
    );
  }

  close(): void {
    this.db.close();
  }
}
