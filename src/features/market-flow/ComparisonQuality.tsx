import type { FeedStatus } from './feed';
import { describeFeed, weightTiming, type ComparisonAlignment } from './comparisonData';
import type { IndexDefinition } from './indexDefinitions';
import type { FlowStock, MarketFlow } from './marketFlowModel';
import type { NiftyImpact } from './niftyImpactModel';

const clock = (at: number) => new Intl.DateTimeFormat('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Kolkata' }).format(at);
const date = (day: string) => new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${day}T00:00:00Z`));

export function ComparisonQuality({ flow, benchmark, model, definition, provider, alignment }: {
  flow: MarketFlow | null; benchmark?: FlowStock | null; model: NiftyImpact; definition: IndexDefinition;
  provider?: FeedStatus['provider'] | null; alignment?: ComparisonAlignment;
}) {
  const feed = describeFeed(provider);
  const timing = weightTiming(definition.weightAsOf, flow?.date);
  const expiries = [...new Set(model.rows.flatMap(row => row.impact != null && row.stock?.fut ? [row.stock.fut.contractDate] : []))].sort();
  const indexExpiry = benchmark?.source === 'futures' ? benchmark.fut?.contractDate : null;
  const months = new Set([...expiries, ...(indexExpiry ? [indexExpiry] : [])].map(day => day.slice(0, 7)));
  const lag = alignment?.at && alignment.latestAt ? Math.round((alignment.latestAt - alignment.at) / 60_000) : 0;
  const replayLag = alignment?.at && flow ? Math.max(0, Math.floor((flow.asOf - alignment.at) / 60_000)) : 0;
  const warning = timing.warning || feed.mode === 'archive' || months.size > 1;
  return <section className={`ni-quality${warning ? ' has-warning' : ''}`} aria-label="Comparison data quality" data-mode={feed.mode}>
    <div className="ni-quality-heading"><b>{feed.label}</b><span>{flow ? `Session ${date(flow.date)}` : 'Waiting for session'}</span></div>
    <p>{feed.note}</p>
    <dl>
      <div><dt>Shared candle close</dt><dd>{alignment?.at ? `${clock(alignment.at)} IST` : 'Waiting for matching prices'}</dd></div>
      <div><dt>Stock coverage</dt><dd>{model.count}/{definition.members.length} · {model.coverage.toFixed(2)}% weight</dd></div>
      <div><dt>Weight snapshot</dt><dd>{date(definition.weightAsOf)}</dd></div>
    </dl>
    {lag > 0 && <p className="ni-quality-warning">Newest quote: {clock(alignment!.latestAt!)} IST. Display held {lag} min back so stock and index readings use the same minute.</p>}
    {replayLag > 2 && <p className="ni-quality-warning">Shared prices are {replayLag} min behind the feed’s latest market snapshot.</p>}
    {model.count < definition.members.length && <p className="ni-quality-warning">Incomplete coverage. Missing stocks are excluded; remaining weights are not increased.</p>}
    <p className={timing.warning ? 'ni-quality-warning' : ''}>{timing.text}</p>
    <details><summary>Price references and contracts</summary>
      <p>Both returns use each future’s own previous-session close. Prices, estimates and rankings use the shared candle above. The chart starts at its first observed candle; zooming does not reset returns to zero.</p>
      <p>Stock futures expiry: {expiries.length ? expiries.map(date).join(', ') : 'unavailable'}. {definition.shortLabel} future expiry: {indexExpiry ? date(indexExpiry) : 'unavailable'}.</p>
      <p>{months.size > 1 ? 'Different contract months are in use; the comparison has an additional expiry mismatch.' : expiries.length && indexExpiry ? expiries.every(expiry => expiry === indexExpiry) ? 'Stock and index futures expiry dates match.' : 'Contract month matches, but NSE stock futures and BSE Sensex futures expire on different days.' : 'Contract check is waiting for futures data.'} Futures pricing and static weights can still create a gap.</p>
    </details>
  </section>;
}
