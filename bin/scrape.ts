#!/usr/bin/env bun
/**
 * outage.fyi — Scraper CLI
 *
 * Usage:
 *   bun run bin/scrape.ts                         # Scrape all providers once
 *   bun run bin/scrape.ts --provider vercel        # Scrape one provider
 *   bun run bin/scrape.ts --daemon --interval 5m   # Continuous mode
 *   bun run bin/scrape.ts --backfill               # Backfill historical
 */

import { loadConfig } from "../src/config/index.js";
import { OutageDB } from "../src/lib/storage/db.js";
import { PROVIDERS, getProvider, getScraperForProvider } from "../src/lib/scrapers/registry.js";
import { computeScore } from "../src/lib/scoring/engine.js";
import { createLogger } from "../src/utils/logger.js";
import { parseInterval, nowISO } from "../src/utils/time.js";
import type { ScrapeContext, ScoringWindow } from "../src/types/index.js";

const config = loadConfig();
const log = createLogger("scraper", config.logLevel);
const db = new OutageDB(config.dbPath);

function getArg(flag: string): string | undefined {
  const idx = process.argv.indexOf(flag);
  return idx !== -1 && idx < process.argv.length - 1 ? process.argv[idx + 1] : undefined;
}

async function scrapeProvider(provider: typeof PROVIDERS[number]): Promise<void> {
  const scraper = getScraperForProvider(provider);
  if (!scraper) {
    log.warn(`No scraper for ${provider.name} (platform: ${provider.platform}) — skipping`);
    return;
  }

  const ctx: ScrapeContext = {
    provider,
    logger: createLogger(provider.id, config.logLevel),
    fetch: globalThis.fetch,
    userAgent: config.userAgent,
  };

  const result = await scraper(ctx);
  db.logScrape(result);

  if (result.error) {
    log.error(`${provider.name}: ${result.error}`);
    return;
  }

  db.upsertIncidents(result.incidents);
  log.info(`${provider.name}: ${result.incidents.length} incidents in ${result.durationMs}ms (${result.currentStatus})`);

  // Recompute scores
  const windows: ScoringWindow[] = ["7d", "30d", "90d"];
  for (const w of windows) {
    const incidents = db.getIncidentsByProvider(provider.id);
    const score = computeScore(provider.id, incidents, w);
    db.upsertScore(score);
  }
}

async function scrapeAll(): Promise<void> {
  log.info(`Scraping ${PROVIDERS.length} providers...`);
  const start = performance.now();
  let success = 0;
  let fail = 0;

  for (const provider of PROVIDERS) {
    try {
      await scrapeProvider(provider);
      success++;
    } catch (err: any) {
      log.error(`${provider.name} failed: ${err.message}`);
      fail++;
    }
    // Rate limit: 500ms between providers
    await new Promise((r) => setTimeout(r, 500));
  }

  const duration = Math.round(performance.now() - start);
  log.info(`Scrape complete: ${success} ok, ${fail} failed in ${duration}ms`);
}

async function main(): Promise<void> {
  console.log(`\n\x1b[36m  outage.fyi — scraper\x1b[0m\n`);

  const singleProvider = getArg("--provider");
  const daemon = process.argv.includes("--daemon");
  const intervalStr = getArg("--interval") || `${config.scrapeInterval}s`;

  if (singleProvider) {
    const provider = getProvider(singleProvider);
    if (!provider) {
      log.error(`Unknown provider: ${singleProvider}`);
      log.info(`Available: ${PROVIDERS.map((p) => p.id).join(", ")}`);
      process.exit(1);
    }
    await scrapeProvider(provider);
    db.close();
    return;
  }

  await scrapeAll();

  if (daemon) {
    const intervalMs = parseInterval(intervalStr);
    log.info(`Daemon mode: scraping every ${intervalStr}`);
    setInterval(scrapeAll, intervalMs);
  } else {
    db.close();
  }
}

main().catch((err) => {
  log.error(`Fatal: ${err.message}`);
  process.exit(1);
});
