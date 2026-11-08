import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { FlowStock, MarketFlow } from './marketFlowModel';
import { NiftyWeightBoard } from './NiftyWeightBoard';
import { isNifty50Stock, NIFTY_50_WEIGHTS } from './nifty50';

afterEach(cleanup);
beforeEach(() => localStorage.clear());

function stock(symbol: string, changePct: number, side: FlowStock['side']): FlowStock {
  return {
    symbol, name: symbol, kind: 'stock', sector: 'financial', sectorLabel: 'Financial', lot: 1,
    expiry: '2026-11-23', spot: 100, prevClose: 100, spotChangePct: changePct,
    fut: null, futDay: null, futHour: null, futQuarter: null, futures: 'pending',
    changePct, source: 'spot', oiChangePct: null, buildUp: null, side,
    options: { putOi: 0, callOi: 0, putOiAdded: null, callOiAdded: null, pcr: null },
    support: null, support2: null, resistance: null, resistance2: null,
    zone: null, zoneNote: null, profile: [], checks: [], strength: 0, rank: 1, candles: [],
  };
}
function flow(stocks: FlowStock[]): MarketFlow {
  return {
    asOf: Date.parse('2026-11-06T10:15:00+05:30'), date: '2026-11-06', window: 'day', floorPct: 0.5,
    stocks, sectors: [], bullish: stocks.filter(s => s.side === 'bullish'), bearish: stocks.filter(s => s.side === 'bearish'),
    rangebound: stocks.filter(s => s.side === 'rangebound'), unread: [],
    buckets: { LONG_BUILD: [], SHORT_COVER: [], SHORT_BUILD: [], LONG_UNWIND: [] },
    featured: { bullish: [], bearish: [] },
    futures: { read: 0, pending: stocks.length, unavailable: 0, failed: 0, total: stocks.length, latestAt: null }, provisional: true,
  };
}
function future(symbol: string, changes: number[]): FlowStock {
  const reading = stock(symbol, changes.at(-1)!, changes.at(-1)! >= 0 ? 'bullish' : 'bearish');
  const open = Date.parse('2026-11-06T09:15:00+05:30');
  reading.source = 'futures'; reading.futures = 'read';
  reading.fut = { contractDate: reading.expiry, months: [reading.expiry], price: 100 + changes.at(-1)!, priceFrom: 100, priceChange: changes.at(-1)!, priceChangePct: changes.at(-1)!, oi: 1000, oiFrom: 900, oiChange: 100, oiChangePct: 100 / 9, from: null, to: open + changes.length * 60_000, buildUp: 'LONG_BUILD' };
  reading.candles = changes.map((value, i) => ({ at: open + i * 60_000, close: 100 + value, oi: 1000 }));
  return reading;
}

describe('Nifty weight list', () => {
  it('pauses connector motion without changing prices or calculations', () => {
    const view = render(<NiftyWeightBoard flow={flow([future('HDFCBANK', [2])])} status={null} />);
    const toggle = screen.getByRole('button', { name: 'Animate connectors' });
    const price = view.container.querySelector('.nw-stock-quote')!.textContent;
    expect(view.container.querySelector('.ni-layout')).toHaveAttribute('data-motion', 'on');
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-pressed', 'false');
    expect(view.container.querySelector('.ni-layout')).toHaveAttribute('data-motion', 'off');
    expect(view.container.querySelector('.nw-stock-quote')).toHaveTextContent(price!);
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-pressed', 'true');
  });

  it('adds recent movers with separate window and session percentages, and opens their stock details', () => {
    const path = Array.from({ length: 61 }, (_, i) => i >= 45 ? 10 - (i - 45) / 5 : 10);
    const view = render(<NiftyWeightBoard flow={flow([future('HDFCBANK', path), future('RELIANCE', path.map(n => -n))])} status={null} />);
    const recentDown = within(screen.getByRole('region', { name: 'Top 5 recent fallers' })).getByRole('button');
    expect(recentDown).toHaveAccessibleName(/HDFCBANK, 15-minute move/);
    expect(recentDown.querySelector('.ni-contributor-title')).toHaveTextContent('−2.55% / 15m');
    expect(recentDown.querySelector('.ni-contributor-move')).toHaveTextContent('Session move+7.20%');
    // The common window ends at 10:15, so use that candle's price, not the later 10:16 print.
    expect(recentDown.querySelector('.ni-contributor-price')).toHaveTextContent('₹107.20');
    expect(recentDown.querySelector('.ni-contributor-weight')).toHaveTextContent('9.95%');
    expect(screen.getByText('10:00–10:15 IST')).toBeInTheDocument();
    fireEvent.click(recentDown);
    expect(screen.getByRole('dialog', { name: 'HDFCBANK in detail' })).toBeInTheDocument();
    expect(view.container.querySelectorAll('.ni-top-section')).toHaveLength(2);
  });
  it('uses futures prices everywhere and never substitutes a cash quote when futures are missing or invalid', () => {
    const hdfc = { ...future('HDFCBANK', [2]), spot: 987.65 };
    const view = render(<NiftyWeightBoard flow={flow([hdfc])} status={null} />);
    const row = () => view.container.querySelector('tr[data-sym="HDFCBANK"]')!;
    expect(row().querySelector('.nw-stock-quote')).toHaveTextContent('₹102');
    expect(row().querySelector('.nw-price-col')).toHaveTextContent('102');
    fireEvent.click(screen.getByRole('button', { name: /^HDFCBANK, index weight/ }));
    const detail = screen.getByRole('dialog');
    expect(within(detail).getByText('Futures')).toBeInTheDocument();
    expect(detail.querySelector('.mf-popup__price')).toHaveTextContent('₹102');
    expect(view.container).not.toHaveTextContent('987.65');
    fireEvent.keyDown(window, { key: 'Escape' });
    fireEvent.click(screen.getByRole('button', { name: 'Full list' }));
    expect(screen.getByRole('columnheader', { name: 'Futures ₹' })).toBeInTheDocument();
    for (const missing of [
      ...[NaN, Infinity, 0, -1].map(price => ({ ...hdfc, fut: { ...hdfc.fut!, price } })),
      { ...hdfc, fut: null },
      { ...hdfc, source: 'spot' as const },
    ]) {
      view.rerender(<NiftyWeightBoard flow={flow([missing])} status={null} />);
      expect(row().querySelector('.nw-stock-quote')).toHaveTextContent('—');
      expect(row().querySelector('.nw-price-col')).toHaveTextContent('—');
      fireEvent.click(screen.getByRole('button', { name: /^HDFCBANK, index weight/ }));
      expect(screen.getByRole('dialog').querySelector('.mf-popup__price > b')).toHaveTextContent('—');
      expect(view.container).not.toHaveTextContent('987.65');
      fireEvent.keyDown(window, { key: 'Escape' });
    }
  });

  it('distinguishes futures price, futures move and index weight in both Top 5 groups', () => {
    const benchmark = { ...future('NIFTY', [1]), prevClose: 25000, kind: 'index' as const };
    render(<NiftyWeightBoard flow={flow([{ ...future('HDFCBANK', [2]), spot: 987.65, spotChangePct: 99 }, { ...future('RELIANCE', [-3]), spot: 888.88 }])} benchmark={benchmark} status={null} />);
    const up = within(screen.getByRole('region', { name: 'Top 5 pushing up' })).getByRole('button');
    expect(up.querySelector('.ni-contributor-price')).toHaveTextContent('Futures ₹₹102');
    expect(up.querySelector('.ni-contributor-move')).toHaveTextContent('Move %+2.00%');
    expect(up.querySelector('.ni-contributor-weight')).toHaveTextContent('Index weight9.95%');
    expect(up.querySelector('.ni-contributor-title')).toHaveTextContent('+49.8 pts');
    const down = within(screen.getByRole('region', { name: 'Top 5 pulling down' })).getByRole('button');
    expect(down.querySelector('.ni-contributor-price')).toHaveTextContent('₹97');
    expect(down.querySelector('.ni-contributor-move')).toHaveTextContent('−3.00%');
    expect(down.querySelector('.ni-contributor-weight')).toHaveTextContent('7.30%');
  });

  it('opens details from any left-row cell and keeps them open while moving over other stocks', () => {
    const view = render(<NiftyWeightBoard flow={flow([future('HDFCBANK', [2]), future('RELIANCE', [-3])])} status={null} />);
    const hdfc = view.container.querySelector('tr[data-sym="HDFCBANK"]')!;
    const reliance = view.container.querySelector('tr[data-sym="RELIANCE"]')!;
    fireEvent.click(hdfc.querySelector('.nw-move-col')!);
    expect(screen.getByRole('dialog', { name: 'HDFCBANK in detail' })).toBeInTheDocument();
    fireEvent.mouseEnter(reliance);
    fireEvent.mouseEnter(within(screen.getByRole('region', { name: 'Top 5 pulling down' })).getByRole('button'));
    expect(screen.getByRole('dialog', { name: 'HDFCBANK in detail' })).toBeInTheDocument();
    fireEvent.click(reliance.querySelector('.nw-impact-col')!);
    expect(screen.getByRole('dialog', { name: 'RELIANCE in detail' })).toBeInTheDocument();
    fireEvent.keyDown(window, { key: 'Escape' });
    fireEvent.click(within(hdfc as HTMLElement).getByRole('button'));
    expect(screen.getByRole('dialog', { name: 'HDFCBANK in detail' })).toBeInTheDocument();
  });

  it('changes colour intensity without changing impact order or direction', () => {
    const view = render(<NiftyWeightBoard flow={flow([future('HDFCBANK', [1]), future('RELIANCE', [-4])])} status={null} />);
    const order = () => [...view.container.querySelectorAll('tbody tr')].map(row => row.getAttribute('data-sym'));
    const before = order();
    const hdfc = view.container.querySelector('tr[data-sym="HDFCBANK"]')!;
    const firstStyle = hdfc.getAttribute('style');
    fireEvent.click(screen.getByRole('button', { name: 'Shade by movement' }));
    expect(order()).toEqual(before);
    expect(hdfc.getAttribute('style')).not.toBe(firstStyle);
    expect(hdfc).toHaveAttribute('data-direction', 'up');
    fireEvent.click(screen.getByRole('button', { name: 'Shade by weight' }));
    expect(order()).toEqual(before);
    expect(hdfc).toHaveStyle({ '--row-heat': '1' });
    expect(view.container.querySelector('tr[data-sym="RELIANCE"]')).toHaveAttribute('data-direction', 'down');
  });

  it('contains the 50 published constituents with valid weights and the official leading order', () => {
    expect(new Set(NIFTY_50_WEIGHTS.map(s => s.symbol)).size).toBe(50);
    expect(NIFTY_50_WEIGHTS.slice(0, 10).map(s => s.symbol)).toEqual([
      'HDFCBANK', 'ICICIBANK', 'RELIANCE', 'BHARTIARTL', 'LT', 'INFY', 'SBIN', 'AXISBANK', 'KOTAKBANK', 'BAJFINANCE',
    ]);
    expect(NIFTY_50_WEIGHTS.reduce((sum, s) => sum + s.weightPct, 0)).toBeCloseTo(99.98, 2);
    expect(NIFTY_50_WEIGHTS.every(s => s.weightPct > 0 && s.weightPct < 100)).toBe(true);
    expect(isNifty50Stock('BSE')).toBe(true);
    expect(isNifty50Stock('WIPRO')).toBe(false);
    expect(isNifty50Stock('NIFTY')).toBe(false);
  });

  it('keeps bullish, bearish, flat and missing quotes in the same weight order after price updates', () => {
    const initial = flow([stock('RELIANCE', 20, 'bullish'), stock('ICICIBANK', 0, 'rangebound'), stock('HDFCBANK', -5, 'bearish')]);
    const view = render(<NiftyWeightBoard flow={initial} status={null} />);
    fireEvent.click(screen.getByRole('button', { name: 'Weight' }));
    const rowOrder = () => [...view.container.querySelectorAll('tbody tr')].map(row => row.getAttribute('data-sym'));
    const before = rowOrder();
    expect(before).toHaveLength(50);
    expect(before.slice(0, 3)).toEqual(['HDFCBANK', 'ICICIBANK', 'RELIANCE']);
    expect(screen.getByRole('button', { name: /^BHARTIARTL, index weight/ })).toBeDisabled();
    view.rerender(<NiftyWeightBoard flow={flow([stock('HDFCBANK', 0, 'rangebound'), stock('BHARTIARTL', 50, 'bullish'), stock('RELIANCE', -30, 'bearish')])} status={null} />);
    expect(rowOrder()).toEqual(before);
    expect(screen.getByRole('button', { name: /^BHARTIARTL, index weight/ })).toBeEnabled();
    expect(screen.getByRole('button', { name: /^ICICIBANK, index weight/ })).toBeDisabled();
  });

  it('opens stock details with weight rank and steps across price directions in weight order', () => {
    render(<NiftyWeightBoard flow={flow([stock('RELIANCE', 10, 'bullish'), stock('HDFCBANK', -4, 'bearish'), stock('ICICIBANK', 0, 'rangebound')])} status={null} />);
    fireEvent.click(screen.getByRole('button', { name: 'Weight' }));
    fireEvent.click(screen.getByRole('button', { name: /^HDFCBANK, index weight/ }));
    const detail = screen.getByRole('dialog', { name: 'HDFCBANK in detail' });
    expect(within(detail).getByText('Weight rank')).toBeInTheDocument();
    expect(within(detail).getByText('9.95%')).toBeInTheDocument();
    fireEvent.click(within(detail).getByRole('button', { name: 'Next: ICICIBANK' }));
    expect(screen.getByRole('dialog', { name: 'ICICIBANK in detail' })).toBeInTheDocument();
    fireEvent.keyDown(document, { key: 'ArrowRight' });
    expect(screen.getByRole('dialog', { name: 'RELIANCE in detail' })).toBeInTheDocument();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('explains a stock contribution on hover and keeps the same rows in full-list mode', () => {
    const hdfc = stock('HDFCBANK', 2, 'bullish');
    hdfc.source = 'futures'; hdfc.futures = 'read';
    hdfc.fut = { contractDate: hdfc.expiry, months: [hdfc.expiry], price: 102, priceFrom: 100, priceChange: 2, priceChangePct: 2, oi: 1000, oiFrom: 900, oiChange: 100, oiChangePct: 100 / 9, from: null, to: Date.parse('2026-11-06T10:15:00+05:30'), buildUp: 'LONG_BUILD' };
    const view = render(<NiftyWeightBoard flow={flow([hdfc])} status={null} />);
    const panel = screen.getByRole('complementary', { name: 'How stocks affect Nifty 50' });
    expect(within(panel).getByText(/1\/50 stocks/)).toHaveTextContent('9.95% weight covered');
    fireEvent.mouseEnter(view.container.querySelector('tr[data-sym="HDFCBANK"]')!);
    expect(within(panel).getByText('Selected stock · HDFCBANK')).toBeInTheDocument();
    expect(view.container.querySelector('.ni-equation')).toHaveTextContent('+0.199 pp');
    fireEvent.click(screen.getByRole('button', { name: 'Full list' }));
    expect(screen.queryByRole('complementary')).not.toBeInTheDocument();
    expect(view.container.querySelectorAll('tbody tr')).toHaveLength(50);
    fireEvent.click(screen.getByRole('button', { name: 'Flow + chart' }));
    expect(screen.getByRole('complementary')).toBeInTheDocument();
  });

  it('sorts absolute impact, converts to points, and preserves a switch back to weight order', () => {
    const stocks = [future('HDFCBANK', [1]), future('ICICIBANK', [1.5]), future('RELIANCE', [-3]), future('LT', [0]), stock('BHARTIARTL', 20, 'bullish')];
    const benchmark = { ...future('NIFTY', [-.5]), prevClose: 25000, kind: 'index' as const };
    const view = render(<NiftyWeightBoard flow={flow(stocks)} benchmark={benchmark} status={null} />);
    const order = () => [...view.container.querySelectorAll('tbody tr')].slice(0, 4).map(row => row.getAttribute('data-sym'));
    expect(order()).toEqual(['RELIANCE', 'ICICIBANK', 'HDFCBANK', 'LT']);
    expect(view.container.querySelector('tr[data-sym="RELIANCE"] .nw-impact-col')).toHaveTextContent('−54.8');
    expect(within(screen.getByRole('region', { name: 'Top 5 pushing up' })).getAllByRole('button')).toHaveLength(2);
    expect(within(screen.getByRole('region', { name: 'Top 5 pulling down' })).getAllByRole('button')).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: /^RELIANCE, index weight/ }));
    expect(within(screen.getByRole('dialog')).getByRole('button', { name: 'Next: ICICIBANK' })).toBeInTheDocument();
    fireEvent.keyDown(window, { key: 'Escape' });
    fireEvent.click(screen.getByRole('button', { name: 'Weight' }));
    expect(order()).toEqual(['HDFCBANK', 'ICICIBANK', 'RELIANCE', 'BHARTIARTL']);
    expect(localStorage.getItem('orderFlow:niftySort')).toBe('weight');
    fireEvent.click(screen.getByRole('button', { name: 'Impact' }));
    view.rerender(<NiftyWeightBoard flow={flow([future('HDFCBANK', [5]), ...stocks.slice(1)])} benchmark={benchmark} status={null} />);
    expect(order()[0]).toBe('HDFCBANK');
  });

  it('inspects matching chart minutes and zooms without changing the return base', () => {
    const stocks = [future('HDFCBANK', Array.from({ length: 30 }, (_, i) => (i + 1) / 10))];
    const benchmark = { ...future('NIFTY', Array.from({ length: 30 }, (_, i) => -(i + 1) / 100)), prevClose: 25000, kind: 'index' as const };
    render(<NiftyWeightBoard flow={flow(stocks)} benchmark={benchmark} status={null} />);
    const slider = screen.getByRole('slider', { name: 'Inspect chart time' });
    fireEvent.change(slider, { target: { value: '9' } });
    expect(screen.getByLabelText('Values at selected chart time')).toHaveTextContent('09:25 IST');
    expect(screen.getByLabelText('Values at selected chart time')).toHaveTextContent('Est. points +24.9 pts');
    fireEvent.click(screen.getByRole('button', { name: '15 min' }));
    expect(slider).toHaveAttribute('max', '15');
    expect(screen.getByLabelText('Values at selected chart time')).toHaveTextContent('09:45 IST');
    expect(screen.getByLabelText('Values at selected chart time')).toHaveTextContent('Est. points +74.6 pts');
    fireEvent.click(screen.getByRole('button', { name: 'Session' }));
    expect(slider).toHaveAttribute('max', '29');
  });

  it('starts the comparison at the latest shared minute and leaves unavailable later values blank', () => {
    const benchmark = { ...future('NIFTY', [-.1, -.2, -.3]), prevClose: 25000, kind: 'index' as const };
    render(<NiftyWeightBoard flow={flow([future('HDFCBANK', [1, 2])])} benchmark={benchmark} status={null} />);
    expect(screen.getByLabelText('Values at selected chart time')).toHaveTextContent('09:17 IST');
    expect(screen.getByLabelText('Values at selected chart time')).toHaveTextContent('Est. points +49.8 pts');
    fireEvent.change(screen.getByRole('slider', { name: 'Inspect chart time' }), { target: { value: '2' } });
    expect(screen.getByLabelText('Values at selected chart time')).toHaveTextContent('09:18 IST');
    expect(screen.getByLabelText('Values at selected chart time')).toHaveTextContent('Weighted estimate —%');
    expect(screen.getByLabelText('Values at selected chart time')).toHaveTextContent('Est. points — pts');
  });
});
