import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { NiftyImpactChart } from './NiftyImpactChart';
import { niftyImpact } from './niftyImpactModel';
import type { FlowStock, MarketFlow } from './marketFlowModel';
import { lineOf } from './flowChartModel';

const open = Date.parse('2026-10-30T09:15:00+05:30');
const stock = (symbol: string, changes: number[]) => ({
  symbol, source: 'futures', prevClose: 100,
  fut: { priceFrom: 100, priceChangePct: changes.at(-1), from: null },
  candles: changes.map((change, i) => ({ at: open + i * 60_000, close: 100 + change, oi: 100 })),
}) as unknown as FlowStock;
const flow = { date: '2026-10-30', window: 'day', futures: { latestAt: open + 180_000 } } as MarketFlow;
const model = niftyImpact([stock('A', [2, 4])], [{ symbol: 'A', name: 'A', rank: 1, weightPct: 100 }]);
afterEach(cleanup);

describe('comparing the same observed minute', () => {
  it('starts at the actual observed return, preserving the opening gap', () => {
    const observed = lineOf(stock('A', [2, 4]), open, open + 180_000, false)!;
    expect(observed.t).toEqual([open + 60_000, open + 120_000]);
    expect(observed.v[0]).toBeCloseTo(2);
  });
  it('shows a percentage-point gap at the latest shared minute and supports inspection', () => {
    render(<NiftyImpactChart flow={flow} benchmark={stock('NIFTY', [3, 7, 20])} model={model} />);
    const gap = screen.getByLabelText('Difference at selected time');
    expect(gap).toHaveTextContent('+3.000 pp');
    expect(screen.getByLabelText('Values at selected chart time')).toHaveTextContent('09:17 IST');
    fireEvent.change(screen.getByRole('slider'), { target: { value: '0' } });
    expect(gap).toHaveTextContent('+1.000 pp');
    fireEvent.click(screen.getByRole('button', { name: 'Latest' }));
    expect(gap).toHaveTextContent('+3.000 pp');
    fireEvent.click(screen.getByRole('button', { name: '15 min' }));
    expect(gap).toHaveTextContent('+3.000 pp');
  });
  it('does not invent a gap at a time where one series is absent', () => {
    render(<NiftyImpactChart flow={flow} benchmark={stock('NIFTY', [3, 7, 20])} model={model} />);
    fireEvent.change(screen.getByRole('slider'), { target: { value: '2' } });
    expect(within(screen.getByLabelText('Difference at selected time')).getByText('No matching candle to compare')).toBeInTheDocument();
    expect(screen.getByLabelText('Difference at selected time')).toHaveTextContent('— pp');
  });
});
