/**
 * outage.fyi — Configuration
 */

import type { AppConfig, LogLevel } from "../types/index.js";

export function loadConfig(): AppConfig {
  return {
    dbPath: process.env.OUTAGE_DB_PATH || ".outage-fyi/outage.db",
    scrapeInterval: parseInt(process.env.OUTAGE_SCRAPE_INTERVAL || "300", 10),
    logLevel: (process.env.OUTAGE_LOG_LEVEL || "info") as LogLevel,
    apiPort: parseInt(process.env.OUTAGE_API_PORT || "3000", 10),
    userAgent: process.env.OUTAGE_USER_AGENT || "outage.fyi/0.1",
  };
}
