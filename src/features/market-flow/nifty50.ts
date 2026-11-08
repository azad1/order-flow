import snapshot from './nifty50-weights.json';

/** Published NSE weights, independent of the replay clock or a stock's price movement. */
export const NIFTY_WEIGHT_DATE = snapshot.asOf;
export const NIFTY_WEIGHT_SOURCE = snapshot.sourceUrl;
export const NIFTY_WEIGHT_DATE_LABEL = new Intl.DateTimeFormat('en-IN', {
  day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC',
}).format(new Date(`${snapshot.asOf}T00:00:00Z`));

export const NIFTY_50_WEIGHTS = [...snapshot.constituents]
  .sort((a, b) => b.weightPct - a.weightPct || b.indexMcapCrore - a.indexMcapCrore || a.symbol.localeCompare(b.symbol))
  .map((stock, index) => ({ ...stock, rank: index + 1 }));

export type NiftyWeight = (typeof NIFTY_50_WEIGHTS)[number];
export const NIFTY_50 = NIFTY_50_WEIGHTS.map(stock => stock.symbol);
const MEMBERS = new Set(NIFTY_50);

/** Stocks only: the NIFTY index is not itself a constituent. */
export function isNifty50Stock(symbol: string): boolean {
  return MEMBERS.has(symbol);
}
