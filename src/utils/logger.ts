/**
 * outage.fyi — Logger
 */

import type { Logger, LogLevel } from "../types/index.js";

const PRIORITY: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 };
const COLORS: Record<LogLevel, string> = {
  debug: "\x1b[2m",
  info: "\x1b[36m",
  warn: "\x1b[33m",
  error: "\x1b[31m",
};
const RESET = "\x1b[0m";
const DIM = "\x1b[2m";

export function createLogger(scope: string, minLevel: LogLevel = "info"): Logger {
  const min = PRIORITY[minLevel];

  function log(level: LogLevel, msg: string, data?: unknown): void {
    if (PRIORITY[level] < min) return;
    const time = new Date().toISOString().slice(11, 23);
    const tag = level.toUpperCase().padEnd(5);
    console.log(`${DIM}${time}${RESET} ${COLORS[level]}${tag}${RESET} \x1b[35m[${scope}]${RESET} ${msg}`);
    if (data !== undefined) {
      console.log(`${DIM}${JSON.stringify(data, null, 2)}${RESET}`);
    }
  }

  return {
    debug: (msg, data?) => log("debug", msg, data),
    info: (msg, data?) => log("info", msg, data),
    warn: (msg, data?) => log("warn", msg, data),
    error: (msg, data?) => log("error", msg, data),
  };
}
