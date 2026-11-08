/** Offline audit of a recorded session; no credentials or broker requests. */
import fs from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { synchronizeFutures, weightTiming } from '../src/features/market-flow/comparisonData.ts';

const root = new URL('../', import.meta.url);
const requested = process.argv[2] || '2026-10-30';
if (!/^\d{4}-\d{2}-\d{2}$/.test(requested)) throw new Error('Use a session date such as 2026-10-30.');
const day = JSON.parse(gunzipSync(fs.readFileSync(new URL(`data/recorded/${requested}.json.gz`, root))));
if (day.date !== requested || day.kind === 'archive') throw new Error('This check needs a recorded session, not reconstructed archive paths.');
console.log(`Recorded session ${day.date}. Both returns use each contract's own previous close.`);
let failed = false;
for (const [index, weightsFile] of [['NIFTY', 'nifty50-weights.json'], ['SENSEX', 'sensex-weights.json']]) {
  const weights = JSON.parse(fs.readFileSync(new URL(`src/features/market-flow/${weightsFile}`, root)));
  const symbols = [index, ...weights.constituents.map(row => row.symbol)];
  const input = new Map(symbols.map(symbol => {
    const months = (day.futures[symbol] ?? []).filter(m => m.date >= day.date).sort((a, b) => a.date.localeCompare(b.date));
    const near = months[0];
    return [symbol, near ? { ...near, symbol, contractDate: near.date, months: months.map(m => m.date) } : null];
  }));
  const aligned = synchronizeFutures(input, symbols, day.date, index);
  const members = weights.constituents.filter(row => aligned.series.get(row.symbol)?.candles.length);
  const benchmark = aligned.series.get(index);
  const coverage = members.reduce((sum, row) => sum + row.weightPct, 0);
  const all = [benchmark, ...members.map(row => aligned.series.get(row.symbol))].filter(Boolean);
  let shared = new Set(benchmark?.candles.map(c => c.at) ?? []);
  for (const series of all) { const times = new Set(series.candles.map(c => c.at)); shared = new Set([...shared].filter(t => times.has(t))); }
  const ok = members.length === weights.constituents.length && !!aligned.at && shared.size > 1;
  failed ||= !ok;
  console.log(`${ok ? 'PASS' : 'FIX'} ${index}: ${members.length}/${weights.constituents.length} stocks; ${coverage.toFixed(2)}% weight; ${shared.size} shared regular-session minutes.`);
  console.log(`  Contracts: stocks ${[...new Set(members.map(row => aligned.series.get(row.symbol).contractDate))].join(', ')}; index ${benchmark?.contractDate ?? 'unavailable'}.`);
  const timing = weightTiming(weights.asOf, day.date);
  console.log(`  ${timing.warning ? 'LIMITATION' : 'NOTE'} weights ${weights.asOf}: ${timing.text}`);
  if (ok) {
    const basket = members.reduce((sum, row) => { const s = aligned.series.get(row.symbol); return sum + row.weightPct * (s.candles.at(-1).close / s.prevClose - 1); }, 0);
    const actual = (benchmark.candles.at(-1).close / benchmark.prevClose - 1) * 100;
    console.log(`  At the shared close: estimate ${basket.toFixed(3)}%; future ${actual.toFixed(3)}%; future minus estimate ${(actual - basket).toFixed(3)} percentage points.`);
  }
}
console.log('Coverage and timestamp checks do not prove the estimate is accurate or independently authenticate the supplied recordings.');
process.exitCode = failed ? 1 : 0;
