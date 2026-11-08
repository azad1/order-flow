import { describe, expect, it } from 'vitest';
import type { FlowStock } from './marketFlowModel';
import { basketHistory, impactHeat, impactPoints, niftyImpact, niftyPointBase, signed, sortedImpacts, stockImpact, valueAt } from './niftyImpactModel';
import { MINUTE } from './flowChartModel';
import { NIFTY_50_WEIGHTS } from './nifty50';
import { SENSEX_INDEX } from './indexDefinitions';

const open = Date.parse('2026-11-06T09:15:00+05:30');
function stock(symbol: string, changes: number[], source: FlowStock['source'] = 'futures'): FlowStock {
  const change = changes.at(-1)!;
  return {
    symbol, source, name: symbol, kind: 'stock', sector: 'financial', sectorLabel: 'Financial', lot: 1,
    expiry: '2026-11-23', spot: 100 + change, prevClose: 100, spotChangePct: change,
    fut: { contractDate: '2026-11-23', months: ['2026-11-23'], price: 100 + change, priceFrom: 100, priceChange: change, priceChangePct: change, oi: 1000, oiFrom: 1000, oiChange: 0, oiChangePct: 0, from: null, to: open + changes.length * MINUTE, buildUp: 'NEUTRAL' },
    futDay: null, futHour: null, futQuarter: null, futures: 'read', changePct: change,
    oiChangePct: 0, buildUp: 'NEUTRAL', side: 'rangebound',
    options: { putOi: 0, callOi: 0, putOiAdded: null, callOiAdded: null, pcr: null },
    support: null, support2: null, resistance: null, resistance2: null,
    zone: null, zoneNote: null, profile: [], checks: [], strength: 0, rank: 1,
    candles: changes.map((value, i) => ({ at: open + i * MINUTE, close: 100 + value, oi: 1000 })),
  };
}

describe('estimated Nifty contribution', () => {
  it('uses Sensex membership and weights without borrowing Nifty weights or its point base', () => {
    const model = niftyImpact([stock('HDFCBANK', [2]), stock('BSE', [20]), stock('NIFTY', [1])], SENSEX_INDEX.members);
    expect(model.rows).toHaveLength(30);
    expect(new Set(model.rows.map(row => row.symbol)).size).toBe(30);
    expect(SENSEX_INDEX.members.reduce((sum, row) => sum + row.weightPct, 0)).toBeCloseTo(100.01);
    expect(model.count).toBe(1);
    expect(model.coverage).toBe(11.85);
    expect(model.net).toBeCloseTo(.237);
    const base = niftyPointBase({ ...stock('SENSEX', [2]), prevClose: 80000 }, 'SENSEX');
    expect(base).toBe(80000);
    expect(impactPoints(model.net, base)).toBeCloseTo(189.6);
    expect(niftyPointBase({ ...stock('NIFTY', [2]), prevClose: 25000 }, 'SENSEX')).toBeNull();
    expect(niftyPointBase({ ...stock('SENSEX', [2]), prevClose: 80000 })).toBeNull();
    expect(impactHeat(model.rows[0], 'weight', .237, 11.85)).toBe(1);
  });
  it('scales colour intensity independently for impact, movement and weight, keeping missing data neutral', () => {
    const model = niftyImpact([stock('HDFCBANK', [1.5]), stock('RELIANCE', [-4]), stock('ICICIBANK', [0])]);
    const hdfc = model.rows[0];
    const reliance = model.rows[2];
    const max = Math.abs(reliance.impact!);
    expect(impactHeat(hdfc, 'impact', max)).toBeCloseTo(.14925 / .292);
    expect(impactHeat(reliance, 'impact', max)).toBe(1);
    expect(impactHeat(hdfc, 'move', max)).toBe(.5);
    expect(impactHeat(reliance, 'move', max)).toBe(1);
    expect(impactHeat(hdfc, 'weight', max)).toBe(1);
    expect(impactHeat(reliance, 'weight', max)).toBeCloseTo(7.3 / 9.95);
    expect(impactHeat(model.rows[1], 'impact', max)).toBe(0);
    for (const shade of ['impact', 'move', 'weight'] as const) expect(impactHeat(model.rows[3], shade, max)).toBe(0);
  });

  it('uses weight × futures return / 100, including negative and flat moves', () => {
    expect(stockImpact(10, stock('HDFCBANK', [2]))).toBeCloseTo(.2);
    expect(stockImpact(10, stock('HDFCBANK', [-2]))).toBeCloseTo(-.2);
    expect(stockImpact(10, stock('HDFCBANK', [0]))).toBe(0);
  });
  it('excludes spot fallbacks, absent readings and invalid returns rather than assigning zero', () => {
    expect(stockImpact(10, stock('HDFCBANK', [2], 'spot'))).toBeNull();
    expect(stockImpact(10)).toBeNull();
    expect(stockImpact(10, stock('HDFCBANK', [NaN]))).toBeNull();
    expect(niftyImpact([]).net).toBeNull();
  });
  it('keeps all 50 in weight order and never renormalizes an incomplete basket', () => {
    const result = niftyImpact([stock('NIFTY', [8]), stock('ICICIBANK', [-1]), stock('HDFCBANK', [2]), stock('RELIANCE', [5], 'spot')]);
    expect(result.count).toBe(2);
    expect(result.coverage).toBeCloseTo(19.34);
    expect(result.up).toBeCloseTo(.199);
    expect(result.down).toBeCloseTo(-.0939);
    expect(result.net).toBeCloseTo(.1051);
    expect(result.rows).toHaveLength(50);
    expect(result.rows.slice(0, 3).map(row => row.symbol)).toEqual(['HDFCBANK', 'ICICIBANK', 'RELIANCE']);
  });
  it('combines returns only at shared candle times and stops where the stale stock stops', () => {
    const result = basketHistory(niftyImpact([stock('HDFCBANK', [1, 2, 3]), stock('ICICIBANK', [-1, -2])]), open, open + 5 * MINUTE);
    expect(result.line?.t).toEqual([open + MINUTE, open + 2 * MINUTE]);
    expect(result.line?.v[0]).toBeCloseTo(.0056);
    expect(result.line?.v[1]).toBeCloseTo(.0112);
  });
  it('withholds a basket curve when one contributing stock has no history', () => {
    const missing = { ...stock('ICICIBANK', [1]), candles: [] };
    expect(basketHistory(niftyImpact([stock('HDFCBANK', [2]), missing]), open, open + MINUTE).line).toBeNull();
  });
  it('does not show negative zero or positive zero as a direction', () => {
    expect(signed(-.00001)).toBe('0.000');
    expect(signed(.00001)).toBe('0.000');
    expect(signed(null)).toBe('—');
    expect(signed(7.3 * -3 / 100 / 100 * 25000, 1)).toBe('−54.8');
    expect(signed(.15, 1)).toBe('+0.2');
    expect(signed(-.15, 1)).toBe('−0.2');
  });
  it('converts percentage points with the index previous close and refuses absent or invalid bases', () => {
    expect(impactPoints(.2, 25000)).toBe(50);
    expect(impactPoints(-.3, 25000)).toBe(-75);
    expect(impactPoints(0, 25000)).toBe(0);
    for (const base of [null, 0, -1, NaN, Infinity]) expect(impactPoints(.2, base)).toBeNull();
    expect(impactPoints(null, 25000)).toBeNull();
    expect(niftyPointBase({ ...stock('NIFTY', [2]), prevClose: 25000 })).toBe(25000);
    expect(niftyPointBase(stock('HDFCBANK', [2]))).toBeNull();
    expect(niftyPointBase()).toBeNull();
  });
  it('sorts both signs by magnitude, leaves unknowns last and breaks ties by weight rank', () => {
    const model = niftyImpact([stock('RELIANCE', [-4]), stock('HDFCBANK', [1]), stock('ICICIBANK', [0])]);
    expect(sortedImpacts(model.rows, 'impact').slice(0, 3).map(row => row.symbol)).toEqual(['RELIANCE', 'HDFCBANK', 'ICICIBANK']);
    expect(sortedImpacts(model.rows, 'weight').slice(0, 3).map(row => row.symbol)).toEqual(['HDFCBANK', 'ICICIBANK', 'RELIANCE']);
    const tied = model.rows.map(row => ({ ...row, impact: row.symbol === 'HDFCBANK' ? -.1 : row.symbol === 'ICICIBANK' ? .1 : null }));
    expect(sortedImpacts(tied, 'impact').slice(0, 2).map(row => row.symbol)).toEqual(['HDFCBANK', 'ICICIBANK']);
  });
  it('returns at most five true contributors per direction, strongest first', () => {
    const model = niftyImpact(NIFTY_50_WEIGHTS.map((row, i) => stock(row.symbol, [i % 2 ? -1 : 1])));
    expect(model.topUp).toHaveLength(5);
    expect(model.topDown).toHaveLength(5);
    expect(model.topUp.every(row => row.impact! > 0)).toBe(true);
    expect(model.topDown.every(row => row.impact! < 0)).toBe(true);
    expect(model.topUp[0].symbol).toBe('HDFCBANK');
    expect(model.topDown[0].symbol).toBe('ICICIBANK');
    expect(niftyImpact([stock('HDFCBANK', [0])]).topUp).toEqual([]);
    expect(niftyImpact([]).topDown).toEqual([]);
  });
  it('does not fill missing chart timestamps or extrapolate stale candles', () => {
    const line = { symbol: 'NIFTY', t: [open, open + MINUTE, open + 3 * MINUTE], v: [0, 1, 3] };
    expect(valueAt(line, open + MINUTE)).toBe(1);
    expect(valueAt(line, open + 2 * MINUTE)).toBeNull();
    expect(valueAt(line, open + 4 * MINUTE)).toBeNull();
    expect(valueAt(null, open)).toBeNull();
  });
});
