/**
 * Checkpoint save/restore for scrubbing.
 * Saves grid state every 24 ticks (every simulated day).
 */

import { SimulationFields } from './types';
import { cloneFields } from './fields';

const CHECKPOINT_INTERVAL = 24; // every simulated day

export interface Checkpoint {
  tick: number;
  fields: SimulationFields;
}

export class CheckpointStore {
  private checkpoints: Map<number, Checkpoint> = new Map();

  /** Save a checkpoint if this tick is a checkpoint tick */
  maybeSave(tick: number, fields: SimulationFields): boolean {
    if (tick % CHECKPOINT_INTERVAL === 0) {
      this.checkpoints.set(tick, {
        tick,
        fields: cloneFields(fields),
      });
      return true;
    }
    return false;
  }

  /** Force save a checkpoint */
  save(tick: number, fields: SimulationFields): void {
    this.checkpoints.set(tick, {
      tick,
      fields: cloneFields(fields),
    });
  }

  /** Get nearest checkpoint at or before the given tick */
  getNearestBefore(tick: number): Checkpoint | null {
    let best: Checkpoint | null = null;
    for (const [t, cp] of this.checkpoints) {
      if (t <= tick && (best === null || t > best.tick)) {
        best = cp;
      }
    }
    return best;
  }

  /** Clear all checkpoints */
  clear(): void {
    this.checkpoints.clear();
  }
}
