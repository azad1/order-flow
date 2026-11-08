import { useMemo, useState } from 'react';
import { PageBar } from '@/components/chrome/PageBar';
import { ThemeToggle } from '@/components/chrome/ThemeToggle';
import { applyTheme } from '@/lib/applyTheme';
import type { Underlying } from '@/lib/underlyings';
import { NiftyWeightBoard } from './NiftyWeightBoard';
import { FlowStatus } from './FlowStatus';
import { DEFAULT_FLOW_SETTINGS, type FlowSettings } from './marketFlowModel';
import { INDEX_DEFINITIONS, NIFTY_INDEX, type IndexDefinition } from './indexDefinitions';
import { useMarketFlow } from './useMarketFlow';

/*
 * The workspace stylesheet chain, in the order the other pages import it:
 * the shared tokens (`oi-design` publishes --dash-* and the numeric ramp),
 * the shared page finish, then the weight-list layout overrides.
 */
import '@/styles/oi-design-tokens.css';
import './market-flow.css';
import '../underlying/pages-finish.css';
import './nifty-weight-board.css';

/**
 * Each index owns its membership, weight snapshot and comparison future.
 * The same board is remounted on a tab change to clear pinned details and chart cursors.
 */

/** Read each stock's day session using the existing futures calculations. */
const SETTINGS: FlowSettings = { ...DEFAULT_FLOW_SETTINGS, scope: 'stocks' };

interface MarketFlowPageProps {
  universe: Underlying[];
}

/** Name this custom edition while keeping the original project credit visible. */
const BRAND = (
  <div className="mf-brand mf-brand--estimator">
    <span className="mf-brand__name">Nifty &amp; Sensex <em>Estimator</em></span>
    <a className="mf-brand__credit" href="https://mrchartist.com/open-source/order-flow" target="_blank" rel="noreferrer">Based on Order Flow by Mr. Chartist</a>
  </div>
);

export function MarketFlowPage({ universe }: MarketFlowPageProps) {
  const [indexId, setIndexId] = useState<IndexDefinition['id']>(() => {
    try { return localStorage.getItem('orderFlow:index') === 'sensex' ? 'sensex' : 'nifty50'; } catch { return 'nifty50'; }
  });
  const definition = INDEX_DEFINITIONS.find(index => index.id === indexId) ?? NIFTY_INDEX;
  const changeIndex = (id: IndexDefinition['id']) => {
    setIndexId(id);
    try { localStorage.setItem('orderFlow:index', id); } catch { /* Storage is optional. */ }
  };
  const shown = useMemo(() => {
    const bySymbol = new Map(universe.filter(item => item.kind === 'stock').map(item => [item.symbol, item]));
    return definition.members.flatMap(({ symbol }) => {
      const stock = bySymbol.get(symbol);
      return stock ? [stock] : [];
    });
  }, [universe, definition]);
  const benchmark = useMemo(() => universe.find(item => item.symbol === definition.symbol && item.kind === 'index'), [universe, definition]);
  const { flow, benchmarkStock, market, loading, error, provider, futuresRead, futuresTotal, rescan } = useMarketFlow(shown, SETTINGS, benchmark);

  const pageActions = (
    <>
      <span className="nw-scope">{definition.members.length} stocks · futures</span>
      <ThemeToggle onChange={theme => applyTheme(theme)} size="md" className="ui-flow-theme" />
    </>
  );

  return (
    <div className="ui-flow oi-design" data-window="day" data-universe={indexId} data-layout="weights">
      <h1 className="is-visually-hidden">Nifty &amp; Sensex Estimator</h1>
      <PageBar current="Nifty & Sensex Estimator" crumbs={false} className="oi-design ui-flow-pagebar" brand={BRAND}>{pageActions}</PageBar>
      <div className="nw-index-nav"><div role="tablist" aria-label="Choose index" className="nw-index-tabs">
        {INDEX_DEFINITIONS.map((index, position) => <button type="button" role="tab" id={`${index.id}-tab`} key={index.id} aria-selected={indexId === index.id} aria-controls={`${index.id}-board`} tabIndex={indexId === index.id ? 0 : -1} onClick={() => changeIndex(index.id)} onKeyDown={event => {
          if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
          event.preventDefault();
          const next = event.key === 'Home' ? INDEX_DEFINITIONS[0] : event.key === 'End' ? INDEX_DEFINITIONS.at(-1)! : INDEX_DEFINITIONS[(position + 1) % INDEX_DEFINITIONS.length];
          changeIndex(next.id);
          document.getElementById(`${next.id}-tab`)?.focus();
        }}>{index.label}</button>)}
      </div><span>Estimating index movement from weighted stock futures.</span></div>
      <div role="tabpanel" id={`${indexId}-board`} aria-labelledby={`${indexId}-tab`}>
      <NiftyWeightBoard key={indexId} definition={definition} flow={flow} benchmark={benchmarkStock}
        status={<FlowStatus flow={flow} at={market?.at ?? null} loading={loading} error={error} provider={provider} futuresRead={futuresRead} futuresTotal={futuresTotal} onRescan={rescan} />} />
      </div>
    </div>
  );
}
