import { lineOf, type FlowLine } from './flowChartModel';
import type { FlowStock } from './marketFlowModel';
import { NIFTY_50_WEIGHTS } from './nifty50';
import type { IndexMember } from './indexDefinitions';

/** Never display a cash fallback as a futures quote. */
export function futuresQuote(stock?: FlowStock | null): number | null {
  const price = stock?.source === 'futures' ? stock.fut?.price : null;
  return price != null && Number.isFinite(price) && price > 0 ? price : null;
}

/** A dated-weight futures proxy, in percentage points, not official cash-index attribution. */
export function stockImpact(weightPct: number, stock?: FlowStock): number | null {
  if (stock?.source !== 'futures' || !stock.fut || !Number.isFinite(stock.fut.priceChangePct)) return null;
  return weightPct * stock.fut.priceChangePct / 100;
}

export function niftyImpact(stocks: readonly FlowStock[], members: readonly IndexMember[] = NIFTY_50_WEIGHTS) {
  const readings = new Map(stocks.map(stock => [stock.symbol, stock]));
  const rows = members.map(member => {
    const stock = readings.get(member.symbol);
    return { ...member, stock, impact: stockImpact(member.weightPct, stock) };
  });
  const available = rows.filter(row => row.impact !== null);
  const up = available.reduce((sum, row) => sum + Math.max(0, row.impact!), 0);
  const down = available.reduce((sum, row) => sum + Math.min(0, row.impact!), 0);
  return {
    rows, up, down, net: available.length ? up + down : null,
    count: available.length,
    coverage: available.reduce((sum, row) => sum + row.weightPct, 0),
    leaders: [...available].sort((a, b) => Math.abs(b.impact!) - Math.abs(a.impact!)).slice(0, 3),
    topUp: available.filter(row => row.impact! > 0).sort((a, b) => b.impact! - a.impact! || a.rank - b.rank).slice(0, 5),
    topDown: available.filter(row => row.impact! < 0).sort((a, b) => a.impact! - b.impact! || a.rank - b.rank).slice(0, 5),
  };
}
export type NiftyImpact = ReturnType<typeof niftyImpact>;
export type ImpactSort = 'impact' | 'weight';
export type ImpactShade = 'impact' | 'move' | 'weight';

/** Independent visual encodings: colour follows direction, intensity follows the chosen factor. */
export function impactHeat(row: NiftyImpact['rows'][number], shade: ImpactShade, largestImpact: number, largestWeight = NIFTY_50_WEIGHTS[0].weightPct): number {
  if (row.impact === null) return 0;
  const value = shade === 'weight' ? row.weightPct / largestWeight
    : shade === 'move' ? Math.abs(row.stock?.fut?.priceChangePct ?? 0) / 3
      : Math.abs(row.impact) / Math.max(.000001, largestImpact);
  return Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;
}

/** A cash-index reference for estimated points. Never substitute a futures price silently. */
export function niftyPointBase(benchmark?: FlowStock | null, symbol = 'NIFTY'): number | null {
  const base = benchmark?.symbol === symbol ? benchmark.prevClose : null;
  return base != null && Number.isFinite(base) && base > 0 ? base : null;
}

export function impactPoints(percentagePoints: number | null | undefined, indexPreviousClose: number | null): number | null {
  if (percentagePoints == null || !Number.isFinite(percentagePoints) || indexPreviousClose == null || !Number.isFinite(indexPreviousClose) || indexPreviousClose <= 0) return null;
  return percentagePoints / 100 * indexPreviousClose;
}

export function sortedImpacts(rows: NiftyImpact['rows'], sort: ImpactSort): NiftyImpact['rows'] {
  return [...rows].sort((a, b) => {
    if (sort === 'weight') return a.rank - b.rank;
    if (a.impact === null) return b.impact === null ? a.rank - b.rank : 1;
    if (b.impact === null) return -1;
    return Math.abs(b.impact) - Math.abs(a.impact) || a.rank - b.rank;
  });
}

/** Exact candle lookup: the chart never invents a value beyond a series' last print. */
export function valueAt(line: FlowLine | null, at: number): number | null {
  if (!line) return null;
  const index = line.t.indexOf(at);
  return index < 0 ? null : line.v[index];
}

/** Only shared, observed candle closes are combined. Never stretch a stale quote or invent missing returns. */
export function basketHistory(model: NiftyImpact, t0: number, t1: number): { line: FlowLine | null; count: number } {
  const available = model.rows.filter(row => row.impact !== null);
  const lines = available.flatMap(row => {
    const line = row.stock ? lineOf(row.stock, t0, t1) : null;
    return line ? [{ weight: row.weightPct / 100, values: new Map(line.t.map((t, i) => [t, line.v[i]])) }] : [];
  });
  // An incomplete history must not imply the same basket as the headline.
  if (!lines.length || lines.length !== available.length) return { line: null, count: lines.length };
  const shared = [...lines[0].values.keys()].filter(t => lines.every(line => line.values.has(t))).sort((a, b) => a - b);
  if (shared.length < 2) return { line: null, count: lines.length };
  return { line: { symbol: 'WEIGHTED_BASKET', t: shared, v: shared.map(t => lines.reduce((sum, line) => sum + line.weight * line.values.get(t)!, 0)) }, count: lines.length };
}

export function signed(value: number | null | undefined, digits = 3): string {
  if (value == null || !Number.isFinite(value)) return '—';
  const scale = 10 ** digits;
  // Remove binary arithmetic noise at decimal halfway values (e.g. 54.74999999999999).
  const magnitude = Math.round((Math.abs(value) + Number.EPSILON * Math.max(1, Math.abs(value))) * scale) / scale;
  const rounded = Math.sign(value) * magnitude;
  return `${rounded > 0 ? '+' : rounded < 0 ? '−' : ''}${Math.abs(rounded).toFixed(digits)}`;
}
