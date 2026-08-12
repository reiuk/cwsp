/**
 * Web Worker entry point: owns the simulation loop.
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
const checkpoints = new CheckpointStore();
let running = false;
let speed = 1; // multiplier on TICKS_PER_SECOND

/**
 * Simulated hours per real second at speed 1, so playback is paced against the
 * clock instead of running as fast as the event loop allows. One simulated day
 * per second puts a full 14-day run at 14 seconds.
 */
const TICKS_PER_SECOND = 24;

/** Sentinel speed meaning "step as fast as this machine manages". One hour of
 *  simulation costs roughly 10ms, so this lands near 90 to 100 hours a second. */
export const SPEED_UNCAPPED = 0;

/**
 * Floor on the gap between rendered snapshots. Each snapshot ships every field
 * for every cell and drives a full React render, so emitting one per simulated
 * hour is what used to saturate the main thread and make Pause feel dead.
 */
const MIN_EMIT_INTERVAL_MS = 33;

/**
 * Ceiling on how many hours are stepped before the loop yields. This is what
 * bounds pause latency: the worker cannot look at its message queue mid-batch,
 * so a batch of four is about 40ms of unresponsiveness in the worst case.
 * Time beyond this is dropped rather than queued, so a backgrounded tab resumes
 * where it left off instead of fast-forwarding.
 */
const MAX_TICKS_PER_ITERATION = 4;

/**
 * Ceiling on how long the loop sleeps between batches. Also the worst-case
 * pause latency, since `running` is only re-checked on waking. At paced speeds
 * the loop sleeps until the next hour is actually due rather than spinning.
 */
const MAX_SLEEP_MS = 20;

/** Minimum yield, so the message queue is always drained between batches. */
const MIN_SLEEP_MS = 1;

function sendMessage(msg: WorkerOutMessage, transfer?: Transferable[]) {
  postMessage(msg, { transfer: transfer || [] });
}

/** Advance exactly one hour, keeping the checkpoint ladder intact.
 *  Checkpoints land on every 24th tick, so this must run for every tick even
 *  when the frame it belongs to is never rendered. */
function advance() {
  if (!state) return;
  stepSimulation(state);
  if (checkpoints.maybeSave(state.tick, state.fields)) {
    sendMessage({ type: 'checkpoint', tick: state.tick });
  }
}

function emitTick() {
  if (!state) return;
  const metrics = computeMetrics(state.fields, state.tissueMap, state.tick, state.params);

  // Serialize fields to transferable buffer
  const buffer = fieldsToBuffer(state.fields);
  sendMessage({ type: 'tick', tick: state.tick, metrics, buffer }, [buffer]);
}

async function runLoop() {
  let last = performance.now();
  let lastEmit = 0;
  let carry = 0;

  while (running && state && state.tick < TOTAL_TICKS) {
    const now = performance.now();
    const dt = (now - last) / 1000;
    last = now;

    carry += speed === SPEED_UNCAPPED
      ? MAX_TICKS_PER_ITERATION
      : dt * TICKS_PER_SECOND * speed;

    // Playback is best effort: never bank more than one batch of debt, so a
    // slow machine or a backgrounded tab runs behind rather than stalling the
    // worker while it catches up.
    if (carry > MAX_TICKS_PER_ITERATION) carry = MAX_TICKS_PER_ITERATION;

    const want = Math.floor(carry);
    if (want > 0) {
      carry -= want;
      const n = Math.min(want, TOTAL_TICKS - state.tick);
      for (let i = 0; i < n; i++) advance();

      if (now - lastEmit >= MIN_EMIT_INTERVAL_MS) {
        emitTick();
        lastEmit = now;
      }
    }

    // Sleep until the next hour is due instead of waking 250 times a second to
    // discover there is nothing to do yet.
    let sleep = MIN_SLEEP_MS;
    if (speed !== SPEED_UNCAPPED) {
      const msPerTick = 1000 / (TICKS_PER_SECOND * speed);
      sleep = Math.min(MAX_SLEEP_MS, Math.max(MIN_SLEEP_MS, Math.ceil((1 - carry) * msPerTick)));
    }
    await new Promise(resolve => setTimeout(resolve, sleep));
  }

  // Land on an exact frame for wherever playback stopped.
  emitTick();

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
      // `??`, not `||`: 0 is the uncapped sentinel, not a missing value.
      speed = msg.speed ?? 1;
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
      advance();
      emitTick();
      break;
    }

    case 'seek': {
      if (!state) return;
      running = false;
      const targetTick = msg.tick;

      if (targetTick <= state.tick) {
        // Need to go backwards, so restore from checkpoint
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
        advance();
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
