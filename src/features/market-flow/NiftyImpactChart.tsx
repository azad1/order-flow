import { useId, useMemo, useState, type PointerEvent } from 'react';
import { chartSpan, lineOf, MINUTE, pathOf } from './flowChartModel';
import type { FlowStock, MarketFlow } from './marketFlowModel';
import { basketHistory, impactPoints, niftyPointBase, signed, valueAt, type NiftyImpact } from './niftyImpactModel';
import { useBox } from './useBox';
import { NIFTY_INDEX, type IndexDefinition } from './indexDefinitions';

const clock = (t: number) => new Intl.DateTimeFormat('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Kolkata' }).format(t);
type ChartRange = 'session' | 'hour' | 'quarter';

export function NiftyImpactChart({ flow, benchmark, model, definition = NIFTY_INDEX }: { flow: MarketFlow | null; benchmark?: FlowStock | null; model: NiftyImpact; definition?: IndexDefinition }) {
  const [measure, box] = useBox<HTMLDivElement>();
  const [range, setRange] = useState<ChartRange>('session');
  const [cursor, setCursor] = useState<number | null>(null);
  const clipId = `nifty-plot-${useId().replace(/:/g, '')}`;
  const history = useMemo(() => {
    if (!flow) return null;
    const [open, close] = chartSpan(flow);
    const basket = basketHistory(model, open, close).line;
    const nifty = benchmark?.symbol === definition.symbol && benchmark.source === 'futures' ? lineOf(benchmark, open, close, false) : null;
    const lines = [basket, nifty].filter(line => line !== null);
    if (!lines.length) return null;
    const end = Math.max(open + MINUTE, ...lines.map(line => line.t.at(-1)!));
    const start = range === 'session' ? open : Math.max(open, end - (range === 'hour' ? 60 : 15) * MINUTE);
    const times = [...new Set(lines.flatMap(line => line.t.filter(t => t >= start && t <= end)))].sort((a, b) => a - b);
    const values = lines.flatMap(line => line.v.filter((_, i) => line.t[i] >= start && line.t[i] <= end));
    const reach = Math.max(.2, Math.ceil(Math.max(...values.map(Math.abs)) * 1.12 * 10) / 10);
    const common = basket && nifty ? times.filter(t => valueAt(basket, t) !== null && valueAt(nifty, t) !== null).at(-1) : undefined;
    return { start, end, reach, basket, nifty, times, comparisonAt: common ?? end, hasCommonTime: common != null };
  }, [flow, benchmark, model, range, definition]);
  const width = box.width || 500;
  const height = 320;
  const left = 49, right = width - 15, top = 16, bottom = height - 28;
  const base = niftyPointBase(benchmark, definition.symbol);
  const nearest = (target: number) => history?.times.reduce((best, t) => Math.abs(t - target) < Math.abs(best - target) ? t : best, history.times[0]);
  const at = history ? nearest(cursor ?? history.comparisonAt)! : 0;
  const selectedIndex = history?.times.indexOf(at) ?? 0;
  const basketValue = history ? valueAt(history.basket, at) : null;
  const niftyValue = history ? valueAt(history.nifty, at) : null;
  const pointValue = impactPoints(basketValue, base);
  const gap = niftyValue != null && basketValue != null ? niftyValue - basketValue : null;
  const x = (t: number) => left + (t - history!.start) / (history!.end - history!.start) * (right - left);
  const y = (v: number) => (top + bottom) / 2 - v / history!.reach * (bottom - top) / 2;
  const area = (line: NonNullable<typeof history>['nifty']) => line ? `${pathOf(line, x, y)}L${x(line.t.at(-1)!).toFixed(1)},${y(0).toFixed(1)}L${x(line.t[0]).toFixed(1)},${y(0).toFixed(1)}Z` : '';
  const point = (event: PointerEvent<SVGSVGElement>) => {
    if (!history) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const relativeX = (event.clientX - rect.left) / rect.width * width;
    const fraction = Math.max(0, Math.min(1, (relativeX - left) / (right - left)));
    setCursor(nearest(history.start + fraction * (history.end - history.start)) ?? null);
  };
  return <div className="ni-interactive-chart" ref={measure} role="group" aria-label={`Interactive ${definition.shortLabel} comparison chart`}>
    <div className="ni-chart-controls"><span>Performance<small>From previous close</small></span><div className="ni-toolbar" role="group" aria-label="Chart time range"><div>{([
      ['session', 'Session'], ['hour', '1 hour'], ['quarter', '15 min'],
    ] as const).map(([value, label]) => <button type="button" key={value} aria-pressed={range === value} onClick={() => { setRange(value); setCursor(null); }}>{label}</button>)}</div></div></div>
    {!history ? <div className="ni-chart-empty">The session chart appears when futures candles arrive.</div> : <>
      <output className="ni-chart-readout" aria-live="off" aria-label="Values at selected chart time">
        <b>{clock(at)} IST · {cursor != null ? 'Selected time' : history.hasCommonTime ? 'Latest shared minute' : 'Latest available candle'}{cursor != null && <button type="button" className="ni-latest-time" onClick={() => setCursor(null)}>Latest</button>}</b><span>{definition.shortLabel} futures <strong>{signed(niftyValue, 3)}%</strong></span><span>Weighted estimate <strong>{signed(basketValue, 3)}%</strong></span><span>Est. points <strong>{signed(pointValue, 1)} pts</strong></span>
      </output>
      <div className="ni-comparison-gap" aria-label="Difference at selected time"><span>Future − estimate</span><b>{signed(gap, 3)} pp</b><small>{gap == null ? 'No matching candle to compare' : 'Percentage-point gap at the same minute'}</small></div>
      <svg className="ni-chart ni-chart-large" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" role="img" aria-label={`Session percentage change: ${definition.label} futures compared with the weighted stock estimate`} onPointerMove={point} onPointerDown={point} onPointerLeave={() => setCursor(null)}>
        <defs>
          <clipPath id={clipId}><rect x={left} y={top} width={right - left} height={bottom - top} /></clipPath>
          <linearGradient id={`${clipId}-wash`} x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="var(--ni-chart-index)" stopOpacity=".2" /><stop offset="100%" stopColor="var(--ni-chart-index)" stopOpacity=".025" /></linearGradient>
        </defs>
        <rect x={left} y={top} width={right - left} height={(bottom - top) / 2} className="ni-chart-positive" />
        <rect x={left} y={(bottom + top) / 2} width={right - left} height={(bottom - top) / 2} className="ni-chart-negative" />
        {[-1, -.5, 0, .5, 1].map(k => <g key={k}><line x1={left} x2={right} y1={y(k * history.reach)} y2={y(k * history.reach)} className={k === 0 ? 'ni-zero' : 'ni-grid'} /><text x={left - 7} y={y(k * history.reach) + 4} textAnchor="end">{signed(k * history.reach, 2)}%</text></g>)}
        {[history.start, (history.start + history.end) / 2, history.end].map((t, i) => <text key={i} x={x(t)} y={height - 7} textAnchor={i === 2 ? 'end' : i === 0 ? 'start' : 'middle'}>{clock(t)}</text>)}
        <g clipPath={`url(#${clipId})`}>
          {history.nifty && <path className="ni-index-area" fill={`url(#${clipId}-wash)`} d={area(history.nifty)} />}
          {history.nifty && <path className="ni-index-glow" d={pathOf(history.nifty, x, y)} />}
          {history.basket && <path className="ni-basket-line" d={pathOf(history.basket, x, y)} />}
          {history.nifty && <path className="ni-nifty-line" d={pathOf(history.nifty, x, y)} />}
          <line className="ni-crosshair" x1={x(at)} x2={x(at)} y1={top} y2={bottom} />
          {basketValue != null && <circle cx={x(at)} cy={y(basketValue)} r="4" className="ni-basket-dot" />}
          {niftyValue != null && <><circle cx={x(at)} cy={y(niftyValue)} r="9" className="ni-index-halo" /><circle cx={x(at)} cy={y(niftyValue)} r="4" className="ni-nifty-dot" /></>}
        </g>
      </svg>
      <input className="ni-time-slider" type="range" min={0} max={Math.max(0, history.times.length - 1)} step={1} value={selectedIndex} aria-label="Inspect chart time" aria-valuetext={`${clock(at)} IST; ${definition.shortLabel} ${signed(niftyValue, 2)} percent; basket ${signed(basketValue, 2)} percent; estimated ${signed(pointValue, 1)} points`} onChange={event => setCursor(history.times[Number(event.target.value)])} />
      <div className="ni-legend"><span><i className="ni-key-nifty" />{definition.shortLabel} futures</span><span><i className="ni-key-basket" />Weighted estimate</span></div>
      <p className="ni-chart-note">{history.basket ? `Basket through ${clock(history.basket.t.at(-1)!)} IST` : 'Basket history unavailable'} · {history.nifty ? `${definition.shortLabel} through ${clock(history.nifty.t.at(-1)!)} IST` : `${definition.shortLabel} future unavailable`}. Hover, tap or move the slider to compare. Returns stay measured from the previous close; gaps mean no matching candle.</p>
    </>}
  </div>;
}
