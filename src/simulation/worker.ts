/**
 * Web Worker entry point — owns the simulation loop.
 *
 * Communication protocol:
 *   Main → Worker: WorkerInMessage
 *   Worker → Main: WorkerOutMessage (with transferable buffer)
 */

import { FIELD_NAMES, TOTAL_TICKS } from './types';
import type { WorkerInMessage, WorkerOutMessage } from './types';
import { createSimulation, stepSimulation } from './engine';
import type { SimulationState } from './engine';
import { computeMetrics } from './metrics';
import { fieldsToBuffer } from './fields';
import { CheckpointStore } from './checkpoints';

let state: SimulationState | null = null;
let checkpoints = new CheckpointStore();
let running = false;
let speed = 1; // ticks per batch

function sendMessage(msg: WorkerOutMessage, transfer?: Transferable[]) {
  postMessage(msg, { transfer: transfer || [] });
}

function emitTick() {
  if (!state) return;
  const metrics = computeMetrics(state.fields, state.tissueMap, state.tick, state.params);

  // Serialize fields to transferable buffer
  const buffer = fieldsToBuffer(state.fields);
  sendMessage({ type: 'tick', tick: state.tick, metrics, buffer }, [buffer]);

  // Save checkpoint if applicable
  if (checkpoints.maybeSave(state.tick, state.fields)) {
    sendMessage({ type: 'checkpoint', tick: state.tick });
  }
}

async function runLoop() {
  while (running && state && state.tick < TOTAL_TICKS) {
    const batchSize = Math.min(speed, TOTAL_TICKS - state.tick);
    for (let i = 0; i < batchSize; i++) {
      stepSimulation(state);
    }
    emitTick();

    // Yield to message processing
    await new Promise(resolve => setTimeout(resolve, 0));
  }

  if (state && state.tick >= TOTAL_TICKS) {
    running = false;
    sendMessage({ type: 'done' });
  }
}

self.onmessage = (e: MessageEvent<WorkerInMessage>) => {
  const msg = e.data;

  switch (msg.type) {
    case 'init': {
      running = false;
      checkpoints.clear();

      try {
        state = createSimulation(msg.scenario, msg.params);
        // Save initial checkpoint
        checkpoints.save(0, state.fields);
        // Emit initial state
        emitTick();
      } catch (err) {
        sendMessage({ type: 'error', message: String(err) });
      }
      break;
    }

    case 'run': {
      if (!state) return;
      speed = msg.speed || 1;
      if (!running) {
        running = true;
        runLoop();
      }
      break;
    }

    case 'pause': {
      running = false;
      break;
    }

    case 'step': {
      if (!state || state.tick >= TOTAL_TICKS) return;
      running = false;
      stepSimulation(state);
      emitTick();
      break;
    }

    case 'seek': {
      if (!state) return;
      running = false;
      const targetTick = msg.tick;

      if (targetTick <= state.tick) {
        // Need to go backwards — restore from checkpoint
        const cp = checkpoints.getNearestBefore(targetTick);
        if (cp) {
          // Restore fields from checkpoint
          for (const name of FIELD_NAMES) {
            state.fields[name].set(cp.fields[name]);
          }
          state.tick = cp.tick;
        } else {
          // No checkpoint before target, re-init
          state = createSimulation(state.scenario);
        }
      }

      // Simulate forward to target
      while (state.tick < targetTick && state.tick < TOTAL_TICKS) {
        stepSimulation(state);
        checkpoints.maybeSave(state.tick, state.fields);
      }
      emitTick();
      break;
    }

    case 'setOverlay': {
      // Overlay mode is handled by the renderer, not the worker
      // Just re-emit current state
      if (state) emitTick();
      break;
    }
  }
};
