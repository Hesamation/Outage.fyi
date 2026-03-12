/**
 * outage.fyi — Shared Types
 */

// ─── Provider ────────────────────────────────────────────────────────────────

export interface Provider {
  id: string;
  name: string;
  url: string;
  statusUrl: string;
  platform: StatusPagePlatform;
  category: ProviderCategory;
  components: string[];
}

export type StatusPagePlatform = "statuspage" | "instatus" | "cachet" | "custom";

export type ProviderCategory =
  | "cloud"
  | "hosting"
  | "database"
  | "auth"
  | "payments"
  | "messaging"
  | "monitoring"
  | "devtools"
  | "ai";

// ─── Incident ────────────────────────────────────────────────────────────────

export type IncidentSeverity = "minor" | "major" | "critical" | "maintenance";
export type IncidentStatus = "investigating" | "identified" | "monitoring" | "resolved" | "postmortem";

export interface Incident {
  id: string;
  providerId: string;
  externalId: string;
  title: string;
  status: IncidentStatus;
  severity: IncidentSeverity;
  components: string[];
  startedAt: string;         // ISO 8601
  resolvedAt: string | null; // ISO 8601, null if ongoing
  durationMinutes: number | null;
  url: string | null;
  updates: IncidentUpdate[];
  scrapedAt: string;         // ISO 8601, when we last fetched this
}

export interface IncidentUpdate {
  status: IncidentStatus;
  body: string;
  createdAt: string; // ISO 8601
}

// ─── Scoring ─────────────────────────────────────────────────────────────────

export type ScoringWindow = "7d" | "30d" | "90d" | "1y";

export interface ReliabilityScore {
  providerId: string;
  window: ScoringWindow;
  computedAt: string;
  uptimePercent: number;
  mttrMinutes: number;
  incidentCount: number;
  severityDistribution: Record<IncidentSeverity, number>;
  avgResponseMinutes: number;
  score: number; // 0-100 composite
}

// ─── Scraper ─────────────────────────────────────────────────────────────────

export interface ScrapeContext {
  provider: Provider;
  logger: Logger;
  fetch: typeof globalThis.fetch;
  userAgent: string;
}

export interface ScrapeResult {
  providerId: string;
  incidents: Incident[];
  currentStatus: "operational" | "degraded" | "partial_outage" | "major_outage" | "maintenance";
  scrapedAt: string;
  durationMs: number;
  error?: string;
}

export interface ScraperAdapter {
  id: string;
  name: string;
  url: string;
  platform: StatusPagePlatform;
  scrape(ctx: ScrapeContext): Promise<ScrapeResult>;
}

// ─── API ─────────────────────────────────────────────────────────────────────

export interface ApiConfig {
  port: number;
  dbPath: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  limit: number;
  offset: number;
}

// ─── Logger ──────────────────────────────────────────────────────────────────

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface Logger {
  debug(msg: string, data?: unknown): void;
  info(msg: string, data?: unknown): void;
  warn(msg: string, data?: unknown): void;
  error(msg: string, data?: unknown): void;
}

// ─── Config ──────────────────────────────────────────────────────────────────

export interface AppConfig {
  dbPath: string;
  scrapeInterval: number;
  logLevel: LogLevel;
  apiPort: number;
  userAgent: string;
}
