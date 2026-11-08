import type { FuturesSeries } from '../options-scanner/futuresModel';
import type { FeedStatus } from './feed';

const MINUTE = 60_000;

export function describeFeed(provider?: FeedStatus['provider'] | null) {
  if (!provider) return { mode: 'unknown', label: 'Checking data source', note: 'The source has not been confirmed yet.' };
  if (provider.id === 'recorded') return { mode: 'recorded', label: 'Recorded replay', note: 'Recorded one-minute futures candles. Historical session, not today’s live prices.' };
  if (provider.id === 'archive') return { mode: 'archive', label: 'Reconstructed replay', note: 'Real daily exchange figures, separately reconstructed intraday paths. Do not use this mode to judge intraday tracking.' };
  if (provider.id === 'demo') return { mode: 'demo', label: 'Simulated demo', note: 'Simulated prices for exploring the interface. No live market feed.' };
  return { mode: 'connected', label: 'Connected API feed', note: 'Check the session date and shared candle time below. A connection alone does not confirm live prices.' };
}

/** A static snapshot is disclosed, never silently relabelled as session-opening weights. */
export function weightTiming(asOf: string, session?: string) {
  if (!session) return { warning: false, text: 'Waiting for the session date.' };
  const days = Math.round((Date.parse(`${session}T00:00:00Z`) - Date.parse(`${asOf}T00:00:00Z`)) / 86_400_000);
  if (days === 0) return { warning: false, text: 'Same-date snapshot; static weights may differ from session-opening weights.' };
  if (days < 0) return { warning: true, text: `Weights are ${-days} days after this session. Historical comparison is approximate.` };
  return { warning: true, text: `Weights are ${days} days before this session. Session-date weights are not loaded; comparison is approximate.` };
}

/** Align prices, rankings and benchmark to an observed minute shared by the available basket. */
export function synchronizeFutures(input: ReadonlyMap<string, FuturesSeries | null>, symbols: readonly string[], session: string, benchmark: string) {
  const open = Date.parse(`${session}T09:15:00+05:30`);
  const close = Date.parse(`${session}T15:30:00+05:30`);
  const series = new Map<string, FuturesSeries | null>();
  for (const symbol of symbols) {
    if (!input.has(symbol)) continue;
    const held = input.get(symbol);
    if (!held || !Number.isFinite(held.prevClose) || !(held.prevClose! > 0) || held.contractDate < session || !/^\d{4}-\d{2}-\d{2}$/.test(held.contractDate)) {
      series.set(symbol, null);
      continue;
    }
    const candles = held.candles.filter(c => c.at >= open && c.at + MINUTE <= close && Number.isFinite(c.at) && Number.isFinite(c.close) && c.close > 0).sort((a, b) => a.at - b.at);
    series.set(symbol, { ...held, candles });
  }
  const available = [...series.values()].filter((s): s is FuturesSeries => !!s?.candles.length && s.prevOi != null && s.prevOi >= 0);
  const index = series.get(benchmark);
  const latestAt = available.length ? Math.max(...available.map(s => s.candles.at(-1)!.at + MINUTE)) : null;
  // Stocks may remain readable while the benchmark is missing; no comparison is claimed.
  if (!index?.candles.length || !available.includes(index) || available.length < 2) return { series, at: null, latestAt };
  let shared = new Set(index.candles.map(c => c.at));
  for (const item of available) {
    const times = new Set(item.candles.map(c => c.at));
    shared = new Set([...shared].filter(t => times.has(t)));
  }
  const last = shared.size ? Math.max(...shared) : null;
  // With no common minute, withhold readings instead of pairing unrelated prices.
  for (const item of available) series.set(item.symbol, { ...item, candles: last == null ? [] : item.candles.filter(c => c.at <= last) });
  return { series, at: last == null ? null : last + MINUTE, latestAt };
}

export type ComparisonAlignment = Pick<ReturnType<typeof synchronizeFutures>, 'at' | 'latestAt'>;
