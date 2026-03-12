#!/usr/bin/env bun
/**
 * outage.fyi — Dataset Export
 *
 * Usage:
 *   bun run bin/export.ts --format json
 *   bun run bin/export.ts --format csv
 *   bun run bin/export.ts --format json --provider vercel
 */

import { loadConfig } from "../src/config/index.js";
import { OutageDB } from "../src/lib/storage/db.js";
import { createLogger } from "../src/utils/logger.js";

const config = loadConfig();
const log = createLogger("export", config.logLevel);
const db = new OutageDB(config.dbPath);

function getArg(flag: string): string | undefined {
  const idx = process.argv.indexOf(flag);
  return idx !== -1 && idx < process.argv.length - 1 ? process.argv[idx + 1] : undefined;
}

const format = getArg("--format") || "json";
const provider = getArg("--provider") || undefined;

const { data } = db.queryIncidents({ providerId: provider, limit: 100000 });

if (format === "csv") {
  const header = "id,provider,title,severity,status,started_at,resolved_at,duration_minutes,components";
  const rows = data.map((i) =>
    `"${i.id}","${i.providerId}","${i.title.replace(/"/g, '""')}","${i.severity}","${i.status}","${i.startedAt}","${i.resolvedAt || ""}",${i.durationMinutes || ""},"${i.components.join(";")}"`,
  );
  console.log([header, ...rows].join("\n"));
} else {
  console.log(JSON.stringify(data, null, 2));
}

log.info(`Exported ${data.length} incidents as ${format}`);
db.close();
