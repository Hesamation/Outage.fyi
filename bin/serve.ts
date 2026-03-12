#!/usr/bin/env bun
/**
 * outage.fyi — API Server
 *
 * Usage:
 *   bun run bin/serve.ts
 *   bun run bin/serve.ts --port 8080
 */

import { loadConfig } from "../src/config/index.js";
import { createServer } from "../src/api/server.js";
import { createLogger } from "../src/utils/logger.js";

const config = loadConfig();
const portArg = process.argv.indexOf("--port");
if (portArg !== -1 && process.argv[portArg + 1]) {
  config.apiPort = parseInt(process.argv[portArg + 1], 10);
}

const log = createLogger("server", config.logLevel);

console.log(`\n\x1b[36m  outage.fyi — api server\x1b[0m\n`);

const server = createServer(config);
log.info(`Listening on http://localhost:${config.apiPort}`);
log.info(`Database: ${config.dbPath}`);
log.info(`Try: curl http://localhost:${config.apiPort}/v1/providers`);
