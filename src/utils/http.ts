/**
 * outage.fyi — HTTP Helpers
 */

import type { Logger } from "../types/index.js";

export interface FetchOptions {
  userAgent: string;
  timeoutMs?: number;
  retries?: number;
  retryDelayMs?: number;
  logger?: Logger;
}

export async function fetchWithRetry(
  url: string,
  options: FetchOptions,
): Promise<Response> {
  const {
    userAgent,
    timeoutMs = 15000,
    retries = 3,
    retryDelayMs = 1000,
    logger,
  } = options;

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    if (attempt > 0) {
      const delay = retryDelayMs * Math.pow(2, attempt - 1);
      logger?.debug(`Retry ${attempt}/${retries} after ${delay}ms`);
      await new Promise((r) => setTimeout(r, delay));
    }

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);

    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent": userAgent,
          Accept: "application/json, text/html",
        },
        signal: ctrl.signal,
      });

      clearTimeout(timer);

      if (res.status === 429) {
        const retryAfter = res.headers.get("retry-after");
        const waitMs = retryAfter ? parseInt(retryAfter, 10) * 1000 : retryDelayMs * 3;
        logger?.warn(`Rate limited by ${url}, waiting ${waitMs}ms`);
        await new Promise((r) => setTimeout(r, waitMs));
        continue;
      }

      if (!res.ok && attempt < retries) {
        logger?.warn(`HTTP ${res.status} from ${url}, retrying`);
        lastError = new Error(`HTTP ${res.status}`);
        continue;
      }

      return res;
    } catch (err: any) {
      clearTimeout(timer);
      lastError = err;
      if (err.name === "AbortError") {
        logger?.warn(`Timeout fetching ${url}`);
      } else {
        logger?.warn(`Fetch error: ${err.message}`);
      }
    }
  }

  throw lastError || new Error(`Failed to fetch ${url}`);
}

export async function fetchJson<T>(url: string, options: FetchOptions): Promise<T> {
  const res = await fetchWithRetry(url, options);
  return (await res.json()) as T;
}

export async function fetchHtml(url: string, options: FetchOptions): Promise<string> {
  const res = await fetchWithRetry(url, options);
  return res.text();
}
