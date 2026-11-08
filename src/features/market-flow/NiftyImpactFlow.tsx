import { useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { fmtPrice } from '@/utils/formatters';
import { useFlowFocus } from './flowFocus';
import type { FlowStock, MarketFlow } from './marketFlowModel';
import { futuresQuote, impactPoints, niftyPointBase, signed, type NiftyImpact } from './niftyImpactModel';
import { NiftyImpactChart } from './NiftyImpactChart';
import { NIFTY_INDEX, type IndexDefinition } from './indexDefinitions';
import { RecentMovers } from './RecentMovers';
import { TickFlash } from './FlowParts';

const tone = (v: number | null) => v == null || v === 0 ? '' : v > 0 ? 'ni-up' : 'ni-down';

function EffectNumber({ value, base }: { value: number | null; base: number | null }) {
  return <span className="ni-effect-number"><b>{signed(impactPoints(value, base), 1)} <small>pts</small></b><small>{signed(value)} pp</small></span>;
}

function TopContributors({ model, base, definition }: { model: NiftyImpact; base: number | null; definition: IndexDefinition }) {
  const focus = useFlowFocus();
  const maximum = Math.max(.000001, ...model.rows.map(row => Math.abs(row.impact ?? 0)));
  return <section className="ni-top-section" aria-label={`Top ${definition.shortLabel} contributors`}>
    <div className="ni-top-heading"><div><span className="ni-section-kicker">THE BIGGEST CONTRIBUTORS</span><h3>What is moving {definition.shortLabel}?</h3></div><span>Estimated index points</span></div>
    <div className="ni-top-grid">{([
      { title: 'Top 5 pushing up', rows: model.topUp, style: 'ni-up' },
      { title: 'Top 5 pulling down', rows: model.topDown, style: 'ni-down' },
    ]).map(group => <section key={group.style} className={group.style} aria-label={group.title}>
      <h4><i aria-hidden="true">{group.style === 'ni-up' ? '↗' : '↘'}</i>{group.title}</h4>
      {group.rows.length ? <ol>{group.rows.map(row => <li key={row.symbol} data-sym={row.symbol}>
        <button type="button" aria-label={`${row.symbol}, estimated ${signed(impactPoints(row.impact, base), 1)} points, open details`} onMouseEnter={() => { if (!focus.pinned.symbol) focus.hoverSymbol(row.symbol, 'card'); }} onMouseLeave={() => focus.hoverSymbol(null, 'card')} onFocus={() => { if (!focus.pinned.symbol) focus.hoverSymbol(row.symbol, 'key'); }} onBlur={() => focus.hoverSymbol(null, 'key')} onClick={() => focus.togglePin(row.symbol, 'card')}>
          <span className="ni-contributor-title"><b>{row.symbol}</b><strong>{signed(impactPoints(row.impact, base), 1)} <small>pts</small></strong></span>
          <span className="ni-contributor-metrics">
            <span className="ni-contributor-price"><small>Futures ₹</small><b>{futuresQuote(row.stock) == null ? '—' : `₹${fmtPrice(futuresQuote(row.stock)!)}`}</b></span>
            <span className="ni-contributor-move" title="Futures percentage change since previous close"><small>Move %</small><b>{signed(row.stock?.fut?.priceChangePct, 2)}%</b></span>
            <span className="ni-contributor-weight"><small>Index weight</small><b>{row.weightPct.toFixed(2)}%</b></span>
          </span>
          <i aria-hidden="true"><em style={{ width: `${Math.abs(row.impact!) / maximum * 100}%` }} /></i>
        </button>
      </li>)}</ol> : <p>No {group.style === 'ni-up' ? 'upward' : 'downward'} contributors available.</p>}
    </section>)}</div>
  </section>;
}

interface Connection { symbol: string; y: number; impact: number }

/** The table remains the source of truth; connectors follow its visible rows as it scrolls. */
export function NiftyImpactFlow({ children, model, flow, benchmark, compact, orderKey, definition = NIFTY_INDEX }: { children: ReactNode; model: NiftyImpact; flow: MarketFlow | null; benchmark?: FlowStock | null; compact: boolean; orderKey: string; definition?: IndexDefinition }) {
  const root = useRef<HTMLDivElement>(null);
  const gradientId = `impact-connection-${useId().replace(/:/g, '')}`;
  const focus = useFlowFocus();
  const [selected, setSelected] = useState<string | null>(null);
  const [motion, setMotion] = useState(true);
  const [wires, setWires] = useState<{ x: number; width: number; height: number; upY: number; downY: number; rows: Connection[] }>({ x: 0, width: 0, height: 0, upY: 60, downY: 110, rows: [] });
  useEffect(() => focus.subscribe(state => setSelected(state.symbol)), [focus]);
  useLayoutEffect(() => {
    const node = root.current;
    const table = node?.querySelector<HTMLElement>('.nw-table-wrap');
    const panel = node?.querySelector<HTMLElement>('.ni-panel');
    if (!node || !table || !panel || !compact) return;
    let frame = 0;
    const measure = () => {
      const bounds = node.getBoundingClientRect();
      const a = table.getBoundingClientRect();
      const b = panel.getBoundingClientRect();
      // The cells are sticky; the thead itself scrolls out of view.
      const headBottom = Math.max(a.top, table.querySelector('thead th')?.getBoundingClientRect().bottom ?? a.top);
      const effects = new Map(model.rows.map(row => [row.symbol, row.impact]));
      const rows = [...table.querySelectorAll<HTMLElement>('tbody tr')].flatMap(row => {
        const rect = row.getBoundingClientRect();
        const mid = rect.top + rect.height / 2;
        const symbol = row.dataset.sym!;
        const impact = effects.get(symbol);
        return mid > headBottom && mid < a.bottom - 4 && impact != null && impact !== 0 ? [{ symbol, impact, y: mid - bounds.top }] : [];
      });
      const targetY = (selector: string) => {
        const rect = panel.querySelector(selector)?.getBoundingClientRect();
        return rect ? rect.top + rect.height / 2 - bounds.top : 0;
      };
      setWires({ x: a.right - bounds.left, width: Math.max(0, b.left - a.right), height: Math.max(a.height, b.height), upY: targetY('.ni-push.ni-up'), downY: targetY('.ni-push.ni-down'), rows });
    };
    const schedule = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(measure); };
    measure();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(schedule);
    observer?.observe(node);
    observer?.observe(panel);
    table.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    return () => { observer?.disconnect(); table.removeEventListener('scroll', schedule); window.removeEventListener('resize', schedule); cancelAnimationFrame(frame); };
  }, [model, compact, orderKey]);
  const picked = model.rows.find(row => row.symbol === selected) ?? model.leaders[0];
  const maxImpact = Math.max(.001, ...model.rows.map(row => Math.abs(row.impact ?? 0)));
  const gross = model.up - model.down;
  const reference = benchmark?.symbol === definition.symbol ? benchmark : null;
  const future = reference?.source === 'futures' ? reference.fut : null;
  const pointBase = niftyPointBase(reference, definition.symbol);
  const rising = model.rows.filter(row => row.impact != null && row.impact > 0).length;
  const falling = model.rows.filter(row => row.impact != null && row.impact < 0).length;
  return <><div className={`ni-layout${compact ? ' is-flow' : ' is-list'}`} data-motion={motion ? 'on' : 'off'} ref={root}>
    {children}
    {compact && <>
      <svg className="ni-connectors" style={{ left: wires.x, width: wires.width, height: wires.height }} aria-hidden="true">
        <defs>{(['up', 'down'] as const).map(direction => <linearGradient key={direction} id={`${gradientId}-${direction}`} x1="0%" x2="100%" y1="0%" y2="0%"><stop offset="0%" stopColor={`var(--flow-${direction})`} stopOpacity=".35" /><stop offset="100%" stopColor={`var(--flow-${direction})`} stopOpacity=".9" /></linearGradient>)}</defs>
        {wires.width > 80 && <><text x={wires.width / 2} y="22" textAnchor="middle">STOCK → INDEX</text><text className="ni-wire-caption" x={wires.width / 2} y="37" textAnchor="middle">width = impact</text></>}
        {wires.rows.map((row, i) => {
          const path = `M0,${row.y} C${wires.width * .5},${row.y} ${wires.width * .4},${row.impact >= 0 ? wires.upY : wires.downY} ${wires.width},${row.impact >= 0 ? wires.upY : wires.downY}`;
          const lit = selected === row.symbol ? ' is-lit' : '';
          return <g key={row.symbol}>
            <path data-sym={row.symbol} className={`ni-wire ${tone(row.impact)}${lit}`} style={{ stroke: `url(#${gradientId}-${row.impact > 0 ? 'up' : 'down'})` }} d={path} strokeWidth={1.4 + 9 * Math.abs(row.impact) / maxImpact} />
            <path data-sym={row.symbol} className={`ni-wire-travel ${tone(row.impact)}${lit}`} style={{ '--travel-delay': `${-(i % 7) * .48}s` } as CSSProperties} d={path} pathLength={100} strokeWidth={1.2 + 2 * Math.abs(row.impact) / maxImpact} />
          </g>;
        })}
        {wires.rows.map(row => <circle key={`port-${row.symbol}`} cx="1" cy={row.y} r="2" className={`ni-port ${tone(row.impact)}`} />)}
        {model.up > 0 && <circle cx={wires.width - 1} cy={wires.upY} r="4" className="ni-port ni-up" />}
        {model.down < 0 && <circle cx={wires.width - 1} cy={wires.downY} r="4" className="ni-port ni-down" />}
      </svg>
      <aside className="ni-panel" aria-label={`How stocks affect ${definition.label}`}>
        <div className="ni-panel-title"><span><i aria-hidden="true" />{definition.shortLabel.toUpperCase()} IMPACT</span><button type="button" className="ni-motion-toggle" aria-label="Animate connectors" aria-pressed={motion} onClick={() => setMotion(value => !value)} title="Decorative flow animation; prices update only when data arrives"><span aria-hidden="true">{motion ? 'Ⅱ' : '▷'}</span>{motion ? 'Pause motion' : 'Play motion'}</button></div>
        <div className="ni-push ni-up"><span><i aria-hidden="true">↗</i>Upward effect</span><EffectNumber value={model.count ? model.up : null} base={pointBase} /></div>
        <div className="ni-push ni-down"><span><i aria-hidden="true">↘</i>Downward effect</span><EffectNumber value={model.count ? model.down : null} base={pointBase} /></div>
        <div className="ni-net ni-net-hero">
          <div className="ni-net-heading"><span>Net estimated effect</span><span className="ni-estimate-tag">Futures-based estimate</span></div>
          <span className={tone(model.net)}><EffectNumber value={model.net} base={pointBase} /></span>
          <div className="ni-breadth"><span>{rising} rising</span><span>{falling} falling</span></div>
          <div className={`ni-balance${gross ? '' : ' is-empty'}`} title="Share of gross weighted impact, not stock count"><i style={{ width: `${gross ? model.up / gross * 100 : 0}%` }} /></div>
          <small>{model.count}/{definition.members.length} stocks · {model.coverage.toFixed(2)}% weight covered</small>
        </div>
        <div className="ni-benchmark"><div><span className="ni-section-kicker">THE INDEX · SINCE PREVIOUS CLOSE</span><h3>{definition.label} futures</h3><span>{flow?.date ?? 'Waiting for session'}</span></div><div><b>{futuresQuote(reference) == null ? '—' : fmtPrice(futuresQuote(reference)!)}<TickFlash value={futuresQuote(reference)} /></b><small className={tone(future?.priceChangePct ?? null)}>{signed(future?.priceChangePct, 2)}%</small></div></div>
        <NiftyImpactChart flow={flow} benchmark={reference} model={model} definition={definition} />
        <div className="ni-equation" aria-live="polite">
          <span>{selected ? 'Selected stock' : 'Largest current effect'}{picked ? ` · ${picked.symbol}` : ''}</span>
          {picked?.impact != null ? <><div><b>{picked.weightPct.toFixed(2)}%</b><i>×</i><b>{signed(picked.stock!.fut!.priceChangePct, 2)}%</b><i>÷ 100 =</i><strong className={tone(picked.impact)}>{signed(picked.impact)} pp</strong><i>≈</i><strong className={tone(picked.impact)}>{signed(impactPoints(picked.impact, pointBase), 1)} pts</strong></div><small>Index weight × futures move = estimated contribution</small></> : <p>Waiting for this stock’s futures price.</p>}
        </div>
      </aside>
    </>}
  </div>
  {compact && <div className="ni-below-board"><TopContributors model={model} base={pointBase} definition={definition} /><RecentMovers model={model} flow={flow} definition={definition} /><div className="ni-reading-notes"><p className="ni-explain"><b>Read the board</b> All quoted prices, percentage moves, mini charts and impact estimates use futures. Move % is the futures change since previous close; index weight is the stock’s share of {definition.shortLabel}. Green adds; red subtracts. Line width and impact bars show contribution size. Moving highlights are decorative; values update only with incoming data. Click any stock row or contributor card for details.</p><p className="ni-method">{pointBase ? <>Point estimates = contribution (%) ÷ 100 × {definition.shortLabel} cash-index previous close ({fmtPrice(pointBase)}), used only as the point-conversion reference. </> : <>Point estimates await {definition.shortLabel}’s previous closing level. </>}pp = percentage points. Dated weights and futures returns can differ from the cash {definition.shortLabel} index. Missing stocks are excluded without scaling up the rest. Archive paths are reconstructed, not live ticks. <a href={definition.methodologyUrl} target="_blank" rel="noreferrer">Index methodology</a></p></div></div>}
  </>;
}
