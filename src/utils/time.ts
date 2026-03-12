/**
 * outage.fyi — Time Utilities
 */

export function minutesBetween(start: string, end: string): number {
  const ms = new Date(end).getTime() - new Date(start).getTime();
  return Math.round(ms / 60000);
}

export function windowToMs(window: string): number {
  const match = window.match(/^(\d+)(d|h|m|y)$/);
  if (!match) throw new Error(`Invalid window: ${window}`);
  const n = parseInt(match[1], 10);
  const unit = match[2];
  const multipliers: Record<string, number> = {
    m: 60_000,
    h: 3_600_000,
    d: 86_400_000,
    y: 365.25 * 86_400_000,
  };
  return n * multipliers[unit];
}

export function windowStart(window: string, from?: Date): string {
  const now = from || new Date();
  return new Date(now.getTime() - windowToMs(window)).toISOString();
}

export function nowISO(): string {
  return new Date().toISOString();
}

export function parseInterval(input: string): number {
  const match = input.match(/^(\d+)(s|m|h)$/);
  if (!match) return parseInt(input, 10) * 1000;
  const n = parseInt(match[1], 10);
  const unit = match[2];
  const mult: Record<string, number> = { s: 1000, m: 60000, h: 3600000 };
  return n * mult[unit];
}
