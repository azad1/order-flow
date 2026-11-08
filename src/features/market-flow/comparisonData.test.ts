import { describe, expect, it } from 'vitest';
import type { FuturesSeries } from '../options-scanner/futuresModel';
import { describeFeed, synchronizeFutures, weightTiming } from './comparisonData';

const session = '2026-10-30';
const open = Date.parse(`${session}T09:15:00+05:30`);
const minute = 60_000;
const series = (symbol: string, minutes: number[], overrides: Partial<FuturesSeries> = {}): FuturesSeries => ({
  symbol, contractDate: '2026-11-23', months: ['2026-11-23'], prevClose: 100, prevOi: 100,
  candles: minutes.map(m => ({ at: open + m * minute, close: 100 + m, oi: 100 })), ...overrides,
});

describe('synchronized comparison data', () => {
  it('holds all prices at the latest exact shared candle, without filling missing minutes', () => {
    const input = new Map([['NIFTY', series('NIFTY', [0, 1, 2, 3])], ['A', series('A', [0, 1, 3])], ['B', series('B', [0, 1, 2])]]);
    const result = synchronizeFutures(input, ['NIFTY', 'A', 'B'], session, 'NIFTY');
    expect(result.at).toBe(open + 2 * minute);
    expect(result.latestAt).toBe(open + 4 * minute);
    for (const item of result.series.values()) expect(item!.candles.at(-1)!.at).toBe(open + minute);
    expect(input.get('NIFTY')!.candles).toHaveLength(4);
  });
  it('withholds comparison readings when histories have no shared candle', () => {
    const result = synchronizeFutures(new Map([['NIFTY', series('NIFTY', [0])], ['A', series('A', [1])]]), ['NIFTY', 'A'], session, 'NIFTY');
    expect(result.at).toBeNull();
    expect(result.series.get('NIFTY')!.candles).toEqual([]);
    expect(result.series.get('A')!.candles).toEqual([]);
  });
  it('excludes expired contracts, invalid bases, other sessions and prints after close', () => {
    const input = new Map([
      ['NIFTY', series('NIFTY', [-1, 0, 1, 375])], ['A', series('A', [0, 1, 375])],
      ['expired', series('expired', [0], { contractDate: '2026-10-26' })], ['invalid', series('invalid', [0], { prevClose: NaN })],
    ]);
    const result = synchronizeFutures(input, [...input.keys(), 'pending'], session, 'NIFTY');
    expect(result.at).toBe(open + 2 * minute);
    expect(result.series.get('NIFTY')!.candles).toHaveLength(2);
    expect(result.series.get('expired')).toBeNull();
    expect(result.series.get('invalid')).toBeNull();
    expect(result.series.has('pending')).toBe(false);
  });
  it('does not claim a shared benchmark time before the index has arrived', () => {
    const result = synchronizeFutures(new Map([['A', series('A', [0, 1])]]), ['NIFTY', 'A'], session, 'NIFTY');
    expect(result.at).toBeNull();
    expect(result.series.get('A')!.candles).toHaveLength(2);
  });
  it('does not mistake an always-moving demo or reconstructed archive for live prices', () => {
    expect(describeFeed({ id: 'demo', label: 'Demo', alwaysLive: true }).label).toBe('Simulated demo');
    expect(describeFeed({ id: 'archive', label: 'NSE archive', alwaysLive: true }).label).toBe('Reconstructed replay');
    expect(describeFeed({ id: 'recorded', label: 'Recorded', alwaysLive: true }).label).toBe('Recorded replay');
    expect(describeFeed({ id: 'http', label: 'API', alwaysLive: true }).label).toBe('Connected API feed');
  });
  it('flags both older and future weight snapshots without claiming opening weights match', () => {
    expect(weightTiming(session, session).warning).toBe(false);
    expect(weightTiming(session, session).text).toContain('may differ');
    expect(weightTiming('2026-09-07', session)).toEqual({ warning: true, text: 'Weights are 53 days before this session. Session-date weights are not loaded; comparison is approximate.' });
    expect(weightTiming(session, '2026-10-29').warning).toBe(true);
  });
});
