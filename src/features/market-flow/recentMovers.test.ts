import { describe, expect, it } from 'vitest';
import type { FlowStock } from './marketFlowModel';
import { MINUTE } from './flowChartModel';
import { niftyImpact } from './niftyImpactModel';
import { NIFTY_INDEX, SENSEX_INDEX } from './indexDefinitions';
import { recentMovers } from './recentMoversModel';

const date = '2026-11-06';
const open = Date.parse(`${date}T09:15:00+05:30`);
const end = open + 31 * MINUTE;
function reading(symbol: string, delta: number) {
  const candles = Array.from({ length: 31 }, (_, i) => ({ at: open + i * MINUTE, close: 100 + (i >= 16 ? delta * (i - 15) / 15 : 0), oi: 1000 }));
  return { symbol, source: 'futures', fut: { price: candles.at(-1)!.close, priceFrom: 80, priceChangePct: 20 }, candles } as unknown as FlowStock;
}
const scan = (stocks: FlowStock[], asOf = end) => recentMovers(niftyImpact(stocks), date, asOf);

describe('recent futures movers', () => {
  it('ranks the last 15 minutes independently of the session move and stock weight', () => {
    const result = scan([reading('HDFCBANK', 1), reading('INFY', 3), reading('RELIANCE', -2), reading('LT', 0)]);
    expect(result.start).toBe(end - 15 * MINUTE);
    expect(result.end).toBe(end);
    expect(result.count).toBe(4);
    expect(result.up.map(row => row.symbol)).toEqual(['INFY', 'HDFCBANK']);
    expect(result.down.map(row => row.symbol)).toEqual(['RELIANCE']);
    expect(result.up[0].movePct).toBeCloseTo(3);
    expect(result.down[0].movePct).toBeCloseTo(-2);
    expect(result.down[0].sessionPct).toBeCloseTo(22.5);
    expect(result.down[0].price).toBe(98);
    expect(result.down[0].weightPct).toBe(7.3);
  });

  it('uses one window and excludes stale, short, gapped, invalid and spot histories', () => {
    const stale = reading('HDFCBANK', 3); stale.candles = stale.candles.slice(0, -1);
    const short = reading('ICICIBANK', 3); short.candles = short.candles.slice(-15);
    const gap = reading('RELIANCE', 3); gap.candles = gap.candles.filter((_, i) => i !== 20);
    const invalid = reading('LT', 3); invalid.candles = invalid.candles.map((c, i) => i === 15 ? { ...c, close: 0 } : c);
    const spot = { ...reading('SBIN', 3), source: 'spot' as const };
    const result = scan([stale, short, gap, invalid, spot, reading('INFY', 1)]);
    expect(result.count).toBe(1);
    expect(result.up.map(row => row.symbol)).toEqual(['INFY']);
    expect(scan([reading('INFY', 1)], end + 3 * MINUTE).count).toBe(0);
  });

  it('never reads future candles or an earlier session and waits for a complete window', () => {
    const stock = reading('INFY', 3);
    const result = scan([stock], end - 5 * MINUTE);
    expect(result.end).toBe(end - 5 * MINUTE);
    expect(result.up[0].price).toBe(102);
    expect(recentMovers(niftyImpact([stock]), '2026-11-09', end + 3 * 86400000).count).toBe(0);
    expect(scan([stock], open + 15 * MINUTE).start).toBeNull();
    expect(recentMovers(niftyImpact([stock]), undefined, undefined).up).toEqual([]);
  });

  it('shows at most five per direction, uses weight rank to break ties, and follows Sensex membership', () => {
    const stocks = NIFTY_INDEX.members.map((member, i) => reading(member.symbol, i % 2 ? -2 : 2));
    const result = recentMovers(niftyImpact(stocks, SENSEX_INDEX.members), date, end);
    expect(result.count).toBe(30);
    expect(result.up).toHaveLength(5);
    expect(result.down).toHaveLength(5);
    expect(result.up[0].symbol).toBe('HDFCBANK');
    expect(result.up[0].weightPct).toBe(11.85);
    expect(result.down.every(row => row.movePct < 0)).toBe(true);
    expect(result.up.every(row => row.movePct > 0)).toBe(true);
  });
});
