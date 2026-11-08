import { useMemo } from 'react';
import { fmtPrice } from '@/utils/formatters';
import { useFlowFocus } from './flowFocus';
import type { IndexDefinition } from './indexDefinitions';
import type { MarketFlow } from './marketFlowModel';
import { signed, type NiftyImpact } from './niftyImpactModel';
import { recentMovers, RECENT_MINUTES, sessionClock } from './recentMoversModel';

const moveLabel = (value: number) => Math.abs(value) < .005 && value !== 0 ? `${value < 0 ? '−' : '+'}<0.01` : signed(value, 2);

export function RecentMovers({ model, flow, definition }: { model: NiftyImpact; flow: MarketFlow | null; definition: IndexDefinition }) {
  const focus = useFlowFocus();
  const recent = useMemo(() => recentMovers(model, flow?.date, flow?.asOf), [model, flow?.date, flow?.asOf]);
  const maximum = Math.max(.000001, ...[...recent.up, ...recent.down].map(row => Math.abs(row.movePct)));
  return <section className="ni-top-section ni-recent-section" aria-label={`Recent ${definition.shortLabel} movers`}>
    <div className="ni-top-heading"><div><span className="ni-section-kicker">THE LAST {RECENT_MINUTES} MINUTES</span><h3>Recent movers</h3></div><span className="ni-recent-window">{recent.start != null && recent.end != null ? `${sessionClock(recent.start)}–${sessionClock(recent.end)} IST` : 'Waiting for a full 15-minute window'}</span></div>
    <div className="ni-top-grid">{([
      { title: 'Top 5 recent risers', rows: recent.up, style: 'ni-up' },
      { title: 'Top 5 recent fallers', rows: recent.down, style: 'ni-down' },
    ]).map(group => <section key={group.style} className={group.style} aria-label={group.title}>
      <h4><i aria-hidden="true">{group.style === 'ni-up' ? '↗' : '↘'}</i>{group.title}</h4>
      {group.rows.length ? <ol>{group.rows.map((row, i) => <li key={row.symbol} data-sym={row.symbol}>
        <button type="button" aria-label={`${row.symbol}, ${RECENT_MINUTES}-minute move ${moveLabel(row.movePct)} percent, open details`}
          onMouseEnter={() => { if (!focus.pinned.symbol) focus.hoverSymbol(row.symbol, 'card'); }} onMouseLeave={() => focus.hoverSymbol(null, 'card')}
          onFocus={() => { if (!focus.pinned.symbol) focus.hoverSymbol(row.symbol, 'key'); }} onBlur={() => focus.hoverSymbol(null, 'key')} onClick={() => focus.togglePin(row.symbol, 'card')}>
          <span className="ni-contributor-title"><b><small className="ni-mover-rank">{String(i + 1).padStart(2, '0')}</small>{row.symbol}</b><strong>{moveLabel(row.movePct)}% <small>/ 15m</small></strong></span>
          <span className="ni-contributor-metrics">
            <span className="ni-contributor-price"><small>Futures ₹</small><b>₹{fmtPrice(row.price)}</b></span>
            <span className="ni-contributor-move"><small>Session move</small><b className={row.sessionPct != null && row.sessionPct > 0 ? 'ni-up' : row.sessionPct != null && row.sessionPct < 0 ? 'ni-down' : ''}>{signed(row.sessionPct, 2)}%</b></span>
            <span className="ni-contributor-weight"><small>Index weight</small><b>{row.weightPct.toFixed(2)}%</b></span>
          </span>
          <i aria-hidden="true"><em style={{ width: `${Math.abs(row.movePct) / maximum * 100}%` }} /></i>
        </button>
      </li>)}</ol> : <p>{recent.count ? `No ${group.style === 'ni-up' ? 'rising' : 'falling'} futures in this window.` : 'Waiting for fresh futures with 15 minutes of complete history.'}</p>}
    </section>)}</div>
    <p className="ni-recent-note">Ranked by futures % change over the same 15 minutes. {recent.count}/{definition.members.length} stocks have complete history. Short, stale or incomplete histories are excluded. Archive moves follow the replay.</p>
  </section>;
}
