/**
 * outage.fyi — HTTP API Server
 */

import type { AppConfig } from "../types/index.js";
import { OutageDB } from "../lib/storage/db.js";
import { PROVIDERS, getProvider, listProviders } from "../lib/scrapers/registry.js";
import { computeScore, compareProviders } from "../lib/scoring/engine.js";
import { createLogger } from "../utils/logger.js";
import type { ScoringWindow } from "../types/index.js";

const log = createLogger("api");

export function createServer(config: AppConfig) {
  const db = new OutageDB(config.dbPath);

  return Bun.serve({
    port: config.apiPort,
    fetch(req) {
      const url = new URL(req.url);
      const path = url.pathname;

      // CORS
      const headers = {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      };

      try {
        // GET /v1/health
        if (path === "/v1/health") {
          return Response.json({ status: "ok", providers: PROVIDERS.length }, { headers });
        }

        // GET /v1/providers
        if (path === "/v1/providers") {
          const category = url.searchParams.get("category") || undefined;
          const providers = listProviders(category).map((p) => ({
            id: p.id, name: p.name, category: p.category, url: p.url, statusUrl: p.statusUrl,
          }));
          return Response.json({ data: providers, total: providers.length }, { headers });
        }

        // GET /v1/providers/:id
        const providerMatch = path.match(/^\/v1\/providers\/([a-z0-9-]+)$/);
        if (providerMatch) {
          const provider = getProvider(providerMatch[1]);
          if (!provider) return Response.json({ error: "Provider not found" }, { status: 404, headers });
          return Response.json(provider, { headers });
        }

        // GET /v1/incidents
        if (path === "/v1/incidents") {
          const result = db.queryIncidents({
            providerId: url.searchParams.get("provider") || undefined,
            severity: url.searchParams.get("severity") || undefined,
            since: url.searchParams.get("since") || undefined,
            until: url.searchParams.get("until") || undefined,
            component: url.searchParams.get("component") || undefined,
            limit: parseInt(url.searchParams.get("limit") || "50", 10),
            offset: parseInt(url.searchParams.get("offset") || "0", 10),
          });
          return Response.json(result, { headers });
        }

        // GET /v1/score/:provider
        const scoreMatch = path.match(/^\/v1\/score\/([a-z0-9-]+)$/);
        if (scoreMatch) {
          const provider = getProvider(scoreMatch[1]);
          if (!provider) return Response.json({ error: "Provider not found" }, { status: 404, headers });

          const window = (url.searchParams.get("window") || "90d") as ScoringWindow;
          const incidents = db.getIncidentsByProvider(provider.id);
          const score = computeScore(provider.id, incidents, window);
          db.upsertScore(score);
          return Response.json(score, { headers });
        }

        // GET /v1/compare
        if (path === "/v1/compare") {
          const aId = url.searchParams.get("a");
          const bId = url.searchParams.get("b");
          if (!aId || !bId) return Response.json({ error: "Provide ?a=provider&b=provider" }, { status: 400, headers });

          const provA = getProvider(aId);
          const provB = getProvider(bId);
          if (!provA || !provB) return Response.json({ error: "Provider not found" }, { status: 404, headers });

          const window = (url.searchParams.get("window") || "90d") as ScoringWindow;
          const scoreA = computeScore(aId, db.getIncidentsByProvider(aId), window);
          const scoreB = computeScore(bId, db.getIncidentsByProvider(bId), window);
          const comparison = compareProviders(scoreA, scoreB);

          return Response.json({ a: scoreA, b: scoreB, comparison }, { headers });
        }

        // GET /v1/timeline/:provider
        const timelineMatch = path.match(/^\/v1\/timeline\/([a-z0-9-]+)$/);
        if (timelineMatch) {
          const since = url.searchParams.get("since") || undefined;
          const incidents = db.getIncidentsByProvider(timelineMatch[1], since);
          return Response.json({ data: incidents, total: incidents.length }, { headers });
        }

        // GET /v1/status
        if (path === "/v1/status") {
          // Return latest scrape status for each provider
          const statuses = PROVIDERS.map((p) => {
            const score = db.getScore(p.id, "30d");
            return { id: p.id, name: p.name, score: score?.score ?? null, uptime: score?.uptimePercent ?? null };
          });
          return Response.json({ data: statuses }, { headers });
        }

        return Response.json({ error: "Not found" }, { status: 404, headers });

      } catch (err: any) {
        log.error(`Request failed: ${path} — ${err.message}`);
        return Response.json({ error: "Internal server error" }, { status: 500, headers });
      }
    },
  });
}
