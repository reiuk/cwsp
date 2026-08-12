/**
 * Shared shape and palette for finished runs.
 *
 * Kept out of the component files so those export components only, which is
 * what fast refresh needs to hot-swap them cleanly.
 */

import { TickMetrics } from '../simulation/types';

export interface CompletedRun {
  name: string;
  metrics: TickMetrics[];
  color: string;
}

/** Distinguishable against the accent blue used for the in-progress run. */
const RUN_COLORS = ['#e0644a', '#5ec27f', '#e0a13f', '#a97fd8', '#4fc4c4'];

export function getNextRunColor(index: number): string {
  return RUN_COLORS[index % RUN_COLORS.length];
}
