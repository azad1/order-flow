import { MINUTE } from './flowChartModel';
import { futuresQuote, type NiftyImpact } from './niftyImpactModel';

export const RECENT_MINUTES = 15;
export const sessionClock = (at: number) => new Intl.DateTimeFormat('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Kolkata' }).format(at);

export interface RecentMover {
  symbol: string;
  rank: number;
  weightPct: number;
  price: number;
  movePct: number;
  sessionPct: number | null;
}

/** Compare actual futures closes over one common window, never partial sessions or spot fallbacks. */
export function recentMovers(model: NiftyImpact, date: string | undefined, asOf: number | undefined) {
  const empty = { start: null as number | null, end: null as number | null, count: 0, up: [] as RecentMover[], down: [] as RecentMover[] };
  if (!date || !asOf || !Number.isFinite(asOf)) return empty;
  const open = Date.parse(`${date}T09:15:00+05:30`);
  const close = Date.parse(`${date}T15:30:00+05:30`);
  const limit = Math.min(asOf, close);
  const candidates = model.rows.flatMap(row => {
    if (row.impact === null || futuresQuote(row.stock) === null) return [];
    const prices = new Map(row.stock!.candles.flatMap(candle => {
      const end = candle.at + MINUTE;
      return end > open && end <= limit && Number.isFinite(candle.close) && candle.close > 0 ? [[end, candle.close] as const] : [];
    }));
    return prices.size ? [{ row, prices }] : [];
  });
  const end = Math.max(0, ...candidates.flatMap(({ prices }) => [...prices.keys()]));
  // A lag of up to two minutes accommodates the feed's polling interval, but not stale sessions.
  if (!end || limit - end > 2 * MINUTE) return empty;
  const start = end - RECENT_MINUTES * MINUTE;
  if (start <= open) return { ...empty, end };
  const eligible = candidates.flatMap(({ row, prices }) => {
    for (let at = start; at <= end; at += MINUTE) if (!prices.has(at)) return [];
    const price = prices.get(end)!;
    const movePct = (price / prices.get(start)! - 1) * 100;
    if (!Number.isFinite(movePct)) return [];
    const base = row.stock!.fut!.priceFrom;
    const sessionPct = Number.isFinite(base) && base > 0 ? (price / base - 1) * 100 : null;
    return [{ symbol: row.symbol, rank: row.rank, weightPct: row.weightPct, price, movePct, sessionPct }];
  });
  return {
    start, end, count: eligible.length,
    up: eligible.filter(row => row.movePct > 0).sort((a, b) => b.movePct - a.movePct || a.rank - b.rank).slice(0, 5),
    down: eligible.filter(row => row.movePct < 0).sort((a, b) => a.movePct - b.movePct || a.rank - b.rank).slice(0, 5),
  };
}
