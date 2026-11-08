import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { SymbolMark } from '@/components/common/SymbolMark';
import { fmtPrice } from '@/utils/formatters';
import { FlowFocus, FlowFocusContext } from './flowFocus';
import { FlowPopup } from './FlowPopup';
import { buildUpText, ChangeText, Spark, TickFlash, toneOf } from './FlowParts';
import type { FlowStock, MarketFlow } from './marketFlowModel';
import { NIFTY_INDEX, type IndexDefinition } from './indexDefinitions';
import { NiftyImpactFlow } from './NiftyImpactFlow';
import { ComparisonQuality } from './ComparisonQuality';
import type { ComparisonAlignment } from './comparisonData';
import type { FeedStatus } from './feed';
import { futuresQuote, impactHeat, impactPoints, niftyImpact, niftyPointBase, signed, sortedImpacts, type ImpactShade, type ImpactSort } from './niftyImpactModel';

/** All fifty stocks, with an explicit choice of impact or published-weight order. */
export function NiftyWeightBoard({ flow, status, benchmark, definition = NIFTY_INDEX, provider, alignment }: { flow: MarketFlow | null; status: ReactNode; benchmark?: FlowStock | null; definition?: IndexDefinition; provider?: FeedStatus['provider'] | null; alignment?: ComparisonAlignment }) {
  const [compact, setCompact] = useState(true);
  const [shade, setShade] = useState<ImpactShade>('impact');
  const tableRef = useRef<HTMLDivElement>(null);
  const sortKey = definition.id === 'nifty50' ? 'orderFlow:niftySort' : 'orderFlow:sensexSort';
  const count = definition.members.length;
  const largestWeight = Math.max(...definition.members.map(row => row.weightPct));
  const [sort, setSort] = useState<ImpactSort>(() => {
    try { return localStorage.getItem(sortKey) === 'weight' ? 'weight' : 'impact'; } catch { return 'impact'; }
  });
  const changeSort = (next: ImpactSort) => {
    setSort(next);
    try { localStorage.setItem(sortKey, next); } catch { /* Storage can be unavailable in private mode. */ }
  };
  const focus = useMemo(() => new FlowFocus(), []);
  const attach = useCallback((node: HTMLDivElement | null) => focus.attach(node), [focus]);
  const impact = useMemo(() => niftyImpact(flow?.stocks ?? [], definition.members), [flow, definition]);
  const ordered = useMemo(() => sortedImpacts(impact.rows, sort), [impact, sort]);
  const pointBase = niftyPointBase(benchmark, definition.symbol);
  const largestImpact = Math.max(.000001, ...impact.rows.map(row => Math.abs(row.impact ?? 0)));
  const topTen = definition.members.slice(0, 10).reduce((sum, stock) => sum + stock.weightPct, 0);

  useLayoutEffect(() => { focus.refresh(); }, [focus, flow, compact, sort]);
  useLayoutEffect(() => { if (tableRef.current) tableRef.current.scrollTop = 0; }, [sort]);
  useEffect(() => {
    const close = (event: KeyboardEvent) => { if (event.key === 'Escape') focus.clear(); };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [focus]);

  return (
    <FlowFocusContext.Provider value={focus}>
      <div className="nw-board" ref={attach} onClick={event => {
        if (!(event.target as HTMLElement).closest('[data-sym], .mf-popup')) focus.clear();
      }}>
        <header className="nw-heading">
          <div>
            <p className="nw-eyebrow"><i aria-hidden="true" />{count} stocks · one index</p>
            <h2>{definition.label} by {sort === 'impact' ? 'impact' : 'weightage'}</h2>
            <p className="nw-description">Follow the stocks. Understand the index.</p>
          </div>
          <div className="nw-concentration"><span>Top 10 index weight</span><strong>{topTen.toFixed(2)}%</strong></div>
        </header>
        <div className="nw-status">{status}</div>
        <ComparisonQuality flow={flow} benchmark={benchmark} model={impact} definition={definition} provider={provider} alignment={alignment} />
        <div className="nw-source">
          <span>Weights: <b>{definition.weightDate}</b></span>
          <a href={definition.weightSource} target="_blank" rel="noreferrer">{definition.sourceLabel}</a>
          <div className="ni-toolbar" aria-label="Board view"><div><button type="button" aria-pressed={compact} onClick={() => setCompact(true)}>Flow + chart</button><button type="button" aria-pressed={!compact} onClick={() => setCompact(false)}>Full list</button></div></div>
        </div>
        {definition.weightNote && <p className="nw-weight-note">{definition.weightNote}</p>}
        <div className="nw-sort-row">
          <div className="ni-toolbar" role="group" aria-label="Sort stocks"><span>Sort by</span><div><button type="button" aria-pressed={sort === 'impact'} onClick={() => changeSort('impact')}>Impact</button><button type="button" aria-pressed={sort === 'weight'} onClick={() => changeSort('weight')}>Weight</button></div></div>
          <div className="ni-toolbar nw-shade-controls" role="group" aria-label="Stock colour intensity"><span>Shade by</span><div>{(['impact', 'move', 'weight'] as const).map(value => <button type="button" key={value} aria-label={`Shade by ${value === 'move' ? 'movement' : value}`} aria-pressed={shade === value} onClick={() => setShade(value)}>{value === 'impact' ? 'Impact' : value === 'move' ? 'Move' : 'Weight'}</button>)}</div></div>
        </div>
        <div className="nw-visual-key"><p id="nifty-sort-note">{sort === 'impact' ? 'Largest effect first, up or down' : 'Highest weight first'}</p><span><i className="is-positive" />Up <i className="is-negative" />Down <i className="is-neutral" />Unavailable / flat</span><span>{shade === 'impact' ? 'Deeper shade = larger impact' : shade === 'move' ? 'Deeper shade = stronger move (up to 3%)' : 'Deeper shade = higher index weight'}</span></div>
        <NiftyImpactFlow model={impact} flow={flow} benchmark={benchmark} compact={compact} orderKey={sort} definition={definition}>
        <div className="nw-table-wrap" ref={tableRef} role="region" aria-label={`${definition.label} stock list`} tabIndex={0}>
          <table className="nw-table">
            <caption className="is-visually-hidden">All {count} {definition.label} constituents, ordered by {sort === 'impact' ? 'largest absolute estimated impact' : 'descending index weight'}; weights as of {definition.weightDate}</caption>
            <thead><tr>
              <th scope="col" className="nw-rank">Rank</th>
              <th scope="col">Stock <small className="nw-inline-price-label">Futures ₹</small></th>
              <th scope="col" className="nw-number nw-weight-col" aria-sort={sort === 'weight' ? 'descending' : undefined}>Weight {sort === 'weight' && <span aria-hidden="true">↓</span>}</th>
              <th scope="col" className="nw-number nw-price-col">Futures ₹</th>
              <th scope="col" className="nw-number nw-move-col">Fut. move</th>
              <th scope="col" className="nw-number nw-impact-col" aria-sort={sort === 'impact' ? 'other' : undefined} aria-describedby="nifty-sort-note" title={`Estimated ${definition.shortLabel} points: weight × futures change × ${definition.shortLabel} previous close ÷ 10,000`}>Impact <small>pts</small></th>
              <th scope="col" className="nw-build-col">Build-up</th>
              <th scope="col" className="nw-number nw-oi-col">OI change</th>
            </tr></thead>
            <tbody>
              {ordered.map((member, index) => {
                const stock = member.stock;
                const hasFuture = stock?.source === 'futures' && stock.fut != null;
                const effect = member.impact;
                const points = impactPoints(effect, pointBase);
                const price = futuresQuote(stock);
                const direction = effect == null ? 'unknown' : effect > 0 ? 'up' : effect < 0 ? 'down' : 'flat';
                const state = !stock ? (flow ? 'No market data' : 'Loading…')
                  : stock.futures === 'failed' ? 'Could not load future'
                    : stock.futures === 'unavailable' ? 'No future available'
                      : !hasFuture ? 'Loading future…' : buildUpText(stock);
                return (
                  <tr key={member.symbol} data-sym={member.symbol} data-weight={member.weightPct} data-direction={direction} data-clickable={!!stock} style={{ '--row-heat': impactHeat(member, shade, largestImpact, largestWeight) } as CSSProperties} className={stock ? toneOf(stock) : 'is-flat'} onMouseEnter={() => { if (!focus.pinned.symbol) focus.hoverSymbol(member.symbol, 'tile'); }} onMouseLeave={() => focus.hoverSymbol(null, 'tile')} onClick={event => { if (stock && !(event.target as Element).closest('button')) focus.togglePin(member.symbol, 'tile'); }}>
                    <td className="nw-rank">{index + 1}</td>
                    <th scope="row">
                      <button className="nw-stock" type="button" disabled={!stock}
                        aria-label={`${member.symbol}, index weight ${member.weightPct.toFixed(2)}%, open details`}
                        onFocus={() => { if (!focus.pinned.symbol) focus.hoverSymbol(member.symbol, 'key'); }} onBlur={() => focus.hoverSymbol(null, 'key')}
                        onClick={() => focus.togglePin(member.symbol, 'tile')}>
                        <SymbolMark symbol={member.symbol} kind="stock" size={28} showTitle={false} className="mf-logo" />
                        <span><b>{member.symbol}</b><small className="nw-stock-name">{member.name}</small><span className="nw-stock-quote" title="Futures price from the selected session">{price == null ? '—' : `₹${fmtPrice(price)}`}<TickFlash value={price} /></span><small className="nw-stock-weight">Weight {member.weightPct.toFixed(2)}%</small></span>
                      </button>
                    </th>
                    <td className="nw-number nw-weight-col"><b>{member.weightPct.toFixed(2)}%</b><span className="nw-weight-bar" aria-hidden="true"><i style={{ width: `${member.weightPct / largestWeight * 100}%` }} /></span></td>
                    <td className="nw-number nw-price-col">{price == null ? <span className="nw-muted">—</span> : `₹${fmtPrice(price)}`}</td>
                    <td className="nw-number nw-move-col"><ChangeText value={hasFuture ? stock.fut!.priceChangePct : null} />{hasFuture ? <span className="nw-mini-chart" title="Futures path in the selected session"><Spark stock={stock} width={54} height={19} base /></span> : <small className="nw-spot" title={state}>{stock?.futures === 'failed' || stock?.futures === 'unavailable' ? 'Unavailable' : 'Pending'}</small>}</td>
                    <td className={`nw-number nw-impact-col ${effect == null || effect === 0 ? '' : effect > 0 ? 'ni-up' : 'ni-down'}`} title={`${signed(effect)} percentage points`}><b><span className="nw-direction-arrow" aria-hidden="true">{direction === 'up' ? '↗' : direction === 'down' ? '↘' : ''}</span>{signed(points, 1)}</b><span className="nw-effect-meter" aria-hidden="true"><i style={{ width: `${Math.abs(effect ?? 0) / largestImpact * 100}%` }} /></span></td>
                    <td className="nw-build-col"><span className={hasFuture ? `nw-build ${toneOf(stock)}` : 'nw-muted'}>{state}</span></td>
                    <td className="nw-number nw-oi-col"><ChangeText value={stock?.oiChangePct} digits={1} neutral /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        </NiftyImpactFlow>
        <p className="nw-footnote">{sort === 'impact' ? 'Impact ranks the size of the effect, regardless of direction. Unavailable readings stay at the bottom; equal effects use weight rank.' : 'Weights are rounded; equal weights retain the snapshot order. Weight order stays fixed as prices move.'}</p>
        {flow && <FlowPopup flow={flow} mode="sheet" weightOrder={ordered} />}
      </div>
    </FlowFocusContext.Provider>
  );
}
