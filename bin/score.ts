#!/usr/bin/env bun
/**
 * outage.fyi — Score Recomputation
 *
 * Usage:
 *   bun run bin/score.ts --provider aws
 *   bun run bin/score.ts --all
 */

import { loadConfig } from "../src/config/index.js";
import { OutageDB } from "../src/lib/storage/db.js";
import { PROVIDERS, getProvider } from "../src/lib/scrapers/registry.js";
import { computeScore } from "../src/lib/scoring/engine.js";
import { createLogger } from "../src/utils/logger.js";
import type { ScoringWindow } from "../src/types/index.js";

const config = loadConfig();
const log = createLogger("score", config.logLevel);
const db = new OutageDB(config.dbPath);

const WINDOWS: ScoringWindow[] = ["7d", "30d", "90d", "1y"];

function scoreProvider(providerId: string): void {
  const incidents = db.getIncidentsByProvider(providerId);
  for (const w of WINDOWS) {
    const score = computeScore(providerId, incidents, w);
    db.upsertScore(score);
    log.info(`${providerId} [${w}]: score=${score.score} uptime=${score.uptimePercent}% mttr=${score.mttrMinutes}min incidents=${score.incidentCount}`);
  }
}

const providerArg = process.argv.indexOf("--provider");
const all = process.argv.includes("--all");

if (providerArg !== -1 && process.argv[providerArg + 1]) {
  const id = process.argv[providerArg + 1];
  const provider = getProvider(id);
  if (!provider) { log.error(`Unknown provider: ${id}`); process.exit(1); }
  scoreProvider(id);
} else if (all) {
  log.info(`Recomputing scores for ${PROVIDERS.length} providers...`);
  for (const p of PROVIDERS) scoreProvider(p.id);
} else {
  log.error("Specify --provider <id> or --all");
  process.exit(1);
}

db.close();
