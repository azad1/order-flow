import { NIFTY_50_WEIGHTS, NIFTY_WEIGHT_DATE, NIFTY_WEIGHT_DATE_LABEL, NIFTY_WEIGHT_SOURCE } from './nifty50';
import sensex from './sensex-weights.json';

export interface IndexMember {
  symbol: string;
  name: string;
  weightPct: number;
  rank: number;
}
export interface IndexDefinition {
  id: 'nifty50' | 'sensex';
  label: string;
  shortLabel: string;
  symbol: 'NIFTY' | 'SENSEX';
  members: readonly IndexMember[];
  weightDate: string;
  weightAsOf: string;
  weightSource: string;
  sourceLabel: string;
  weightNote?: string;
  methodologyUrl: string;
}

export const NIFTY_INDEX: IndexDefinition = {
  id: 'nifty50', label: 'Nifty 50', shortLabel: 'Nifty', symbol: 'NIFTY', members: NIFTY_50_WEIGHTS,
  weightDate: NIFTY_WEIGHT_DATE_LABEL, weightAsOf: NIFTY_WEIGHT_DATE, weightSource: NIFTY_WEIGHT_SOURCE, sourceLabel: 'NSE Indices source',
  methodologyUrl: 'https://www.niftyindices.com/indices/equity/broad-based-indices/nifty--50',
};
export const SENSEX_INDEX: IndexDefinition = {
  id: 'sensex', label: 'Sensex', shortLabel: 'Sensex', symbol: 'SENSEX',
  members: sensex.constituents.map((row, i) => ({ ...row, rank: i + 1 })),
  weightDate: new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${sensex.asOf}T00:00:00Z`)),
  weightSource: sensex.sourceUrl, sourceLabel: 'Weights: Solomo / BSE snapshot',
  weightAsOf: sensex.asOf,
  weightNote: 'Sensex uses a dated BSE-reported weight snapshot from Solomo, not current official weights. Stock moves use NSE futures; the comparison line uses BSE Sensex futures. Impacts are estimates.',
  methodologyUrl: 'https://www.bseindices.com/indices-details/code/16',
};
export const INDEX_DEFINITIONS = [NIFTY_INDEX, SENSEX_INDEX] as const;
