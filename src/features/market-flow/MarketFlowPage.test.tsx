import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Underlying } from '@/lib/underlyings';
import type { MarketFlow } from './marketFlowModel';

const hook = vi.hoisted(() => ({ flow: null as MarketFlow | null, universe: [] as string[], benchmark: undefined as string | undefined }));
vi.mock('./useMarketFlow', () => ({
  useMarketFlow: (universe: Array<{ symbol: string }>, _settings: unknown, benchmark?: { symbol: string }) => (hook.universe = universe.map(item => item.symbol), hook.benchmark = benchmark?.symbol, { flow: hook.flow, market: hook.flow ? { at: Date.parse('2026-10-09T10:15:00+05:30') } : null, loading: !hook.flow, error: null, provider: null, futuresRead: 0, futuresTotal: 0, session: null, rescan: () => undefined }),
}));

import { MarketFlowPage } from './MarketFlowPage';
import { NIFTY_INDEX } from './indexDefinitions';

const empty: MarketFlow = {
  asOf: 0, date: '2026-10-09', window: 'day', floorPct: 0.5, stocks: [], sectors: [], bullish: [], bearish: [], rangebound: [], unread: [],
  buckets: { LONG_BUILD: [], SHORT_BUILD: [], SHORT_COVER: [], LONG_UNWIND: [] }, featured: { bullish: [], bearish: [] },
  futures: { read: 0, unavailable: 0, failed: 0, pending: 0, total: 0, latestAt: null }, provisional: false,
};
const nifty = { symbol: 'NIFTY', name: 'Nifty 50', apiKey: 'NSE:NIFTY50', lot: 65, kind: 'index', exch: 'NSE' } as Underlying;
const reliance = { symbol: 'RELIANCE', name: 'Reliance', apiKey: 'NSE:RELIANCE', lot: 500, kind: 'stock', exch: 'NSE' } as Underlying;
const suzlon = { symbol: 'SUZLON', name: 'Suzlon', apiKey: 'NSE:SUZLON', lot: 8000, kind: 'stock', exch: 'NSE' } as Underlying;
const page = (universe: Underlying[] = []) => render(<MemoryRouter><MarketFlowPage universe={universe} /></MemoryRouter>);

beforeEach(() => { localStorage.clear(); hook.flow = empty; });
afterEach(cleanup);

describe('MarketFlowPage', () => {
  it('keeps a single stock-only Nifty view even when All F&O was saved previously', () => {
    localStorage.setItem('orderFlow:universe:v1', 'fno');
    page([nifty, reliance, suzlon]);
    expect(hook.universe).toEqual(['RELIANCE']);
    expect(screen.queryByRole('radio', { name: 'All F&O' })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Nifty 50 by impact' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Weight' }));
    expect(screen.getByRole('heading', { name: 'Nifty 50 by weightage' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /Weight/ })).toHaveAttribute('aria-sort', 'descending');
  });

  it('requests the current members in weight order, including BSE and excluding WIPRO and the index', () => {
    const member = (symbol: string) => ({ ...reliance, symbol });
    page([member('WIPRO'), member('BSE'), reliance, nifty, member('HDFCBANK'), member('ICICIBANK')]);
    expect(hook.universe).toEqual(['HDFCBANK', 'ICICIBANK', 'RELIANCE', 'BSE']);
    expect(hook.benchmark).toBe('NIFTY');
    expect(screen.getByRole('heading', { name: 'Nifty 50 futures' })).toBeInTheDocument();
  });

  it('keeps all 50 rows and the dated weights visible while market data is loading', () => {
    hook.flow = null;
    const { container } = page();
    expect(screen.getByRole('status')).toHaveTextContent('Loading the market…');
    expect(container.querySelectorAll('tbody tr')).toHaveLength(50);
    expect(container.querySelector('tbody tr')).toHaveAttribute('data-sym', 'HDFCBANK');
    expect(screen.getByText('30 October 2026')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^HDFCBANK, index weight 9.95%/ })).toBeDisabled();
  });

  it('switches the whole board to the 30 Sensex members and its own comparison future', () => {
    const sensex = { ...nifty, symbol: 'SENSEX', exch: 'BSE' } as Underlying;
    const { container } = page([nifty, sensex, ...NIFTY_INDEX.members.map(member => ({ ...reliance, symbol: member.symbol }))]);
    expect(hook.universe).toHaveLength(50);
    fireEvent.click(screen.getByRole('tab', { name: 'Sensex' }));
    expect(hook.universe).toHaveLength(30);
    expect(hook.universe).not.toContain('BSE');
    expect(hook.universe).not.toContain('NIFTY');
    expect(hook.benchmark).toBe('SENSEX');
    expect(container.querySelectorAll('tbody tr')).toHaveLength(30);
    expect(screen.getByRole('tabpanel', { name: 'Sensex' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Sensex futures' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'What is moving Sensex?' })).toBeInTheDocument();
    expect(screen.getByText('7 September 2026')).toBeInTheDocument();
    expect(screen.getByText(/not current official weights/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Weights: Solomo / BSE snapshot' })).toHaveAttribute('href', 'https://solomo.ai/markets/sensex/');
    expect(screen.getByRole('button', { name: /^HDFCBANK, index weight 11.85%/ })).toBeInTheDocument();
    expect(localStorage.getItem('orderFlow:index')).toBe('sensex');
    fireEvent.click(screen.getByRole('tab', { name: 'Nifty 50' }));
    expect(hook.universe).toHaveLength(50);
    expect(hook.benchmark).toBe('NIFTY');
    expect(container.querySelectorAll('tbody tr')).toHaveLength(50);
  });

  it('restores the chosen index, keeps sorting separate and supports keyboard tab changes', () => {
    localStorage.setItem('orderFlow:index', 'sensex');
    localStorage.setItem('orderFlow:niftySort', 'weight');
    page();
    expect(screen.getByRole('tab', { name: 'Sensex' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('heading', { name: 'Sensex by impact' })).toBeInTheDocument();
    fireEvent.keyDown(screen.getByRole('tab', { name: 'Sensex' }), { key: 'ArrowLeft' });
    expect(screen.getByRole('tab', { name: 'Nifty 50' })).toHaveFocus();
    expect(screen.getByRole('heading', { name: 'Nifty 50 by weightage' })).toBeInTheDocument();
    fireEvent.keyDown(screen.getByRole('tab', { name: 'Nifty 50' }), { key: 'End' });
    expect(screen.getByRole('heading', { name: 'Sensex by impact' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Weight' }));
    expect(localStorage.getItem('orderFlow:sensexSort')).toBe('weight');
    expect(localStorage.getItem('orderFlow:niftySort')).toBe('weight');
  });

});
