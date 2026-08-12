/**
 * Hook for managing the simulation worker lifecycle.
 *
 * Frame data deliberately does NOT live in React state. A frame is 20 fields of
 * 5000 cells; putting it in state means every rendered frame re-renders the
 * whole app, and in development React also walks the entire object to log the
 * render. The canvas subscribes to frames directly and draws imperatively, so
 * React only sees the scalars it actually displays.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  SimulationFields, ScenarioConfig, TickMetrics,
  WorkerInMessage, WorkerOutMessage,
  OverlayMode, SimulationParams, TOTAL_TICKS,
} from '../simulation/types';
import { bufferToFields } from '../simulation/fields';

export type FrameListener = (fields: SimulationFields) => void;

export interface SimulationHandle {
  tick: number;
  metrics: TickMetrics[];
  running: boolean;
  done: boolean;
  /** Subscribe to frames. Fires immediately with the current frame if there is
   *  one, and returns an unsubscribe function. */
  subscribeFrame: (listener: FrameListener) => () => void;
  init: (scenario: ScenarioConfig, params?: Partial<SimulationParams>) => void;
  play: (speed?: number) => void;
  pause: () => void;
  step: () => void;
  seek: (tick: number) => void;
  setOverlay: (overlay: OverlayMode) => void;
}

/**
 * How often the metrics array is published to React. The canvas wants every
 * frame the worker sends; the four charts do not, and re-rendering their SVG at
 * playback rate is what makes the page feel unresponsive.
 */
const METRICS_FLUSH_MS = 120;

export function useSimulation(): SimulationHandle {
  const workerRef = useRef<Worker | null>(null);
  const [tick, setTick] = useState(0);
  const [metrics, setMetrics] = useState<TickMetrics[]>([]);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);

  // Latest frame plus its subscribers. Neither is state: touching state here
  // would defeat the entire point of the subscription.
  const fieldsRef = useRef<SimulationFields | null>(null);
  const listenersRef = useRef(new Set<FrameListener>());

  // Authoritative metrics list, appended on every tick. `metrics` state is a
  // throttled snapshot of this.
  const metricsRef = useRef<TickMetrics[]>([]);
  const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancelFlush = useCallback(() => {
    if (flushTimerRef.current !== null) {
      clearTimeout(flushTimerRef.current);
      flushTimerRef.current = null;
    }
  }, []);

  const flushMetricsNow = useCallback(() => {
    cancelFlush();
    setMetrics(metricsRef.current.slice());
  }, [cancelFlush]);

  const scheduleMetricsFlush = useCallback(() => {
    if (flushTimerRef.current !== null) return;
    flushTimerRef.current = setTimeout(() => {
      flushTimerRef.current = null;
      setMetrics(metricsRef.current.slice());
    }, METRICS_FLUSH_MS);
  }, []);

  const subscribeFrame = useCallback((listener: FrameListener) => {
    listenersRef.current.add(listener);
    if (fieldsRef.current) listener(fieldsRef.current);
    return () => { listenersRef.current.delete(listener); };
  }, []);

  // Create worker on mount
  useEffect(() => {
    const worker = new Worker(
      new URL('../simulation/worker.ts', import.meta.url),
      { type: 'module' }
    );

    worker.onmessage = (e: MessageEvent<WorkerOutMessage>) => {
      const msg = e.data;
      switch (msg.type) {
        case 'tick': {
          const newFields = bufferToFields(msg.buffer);
          fieldsRef.current = newFields;
          for (const listener of listenersRef.current) listener(newFields);

          const prev = metricsRef.current;
          if (prev.length > 0 && prev[prev.length - 1].tick >= msg.tick) {
            // Seeking backwards, so trim metrics
            metricsRef.current = prev.filter(m => m.tick < msg.tick);
            metricsRef.current.push(msg.metrics);
            flushMetricsNow();
          } else {
            prev.push(msg.metrics);
            scheduleMetricsFlush();
          }

          setTick(msg.tick);
          break;
        }
        case 'done':
          // Publish the final point before anything reads the finished run.
          flushMetricsNow();
          setRunning(false);
          setDone(true);
          break;
        case 'error':
          console.error('Simulation error:', msg.message);
          setRunning(false);
          break;
      }
    };

    workerRef.current = worker;

    return () => {
      worker.terminate();
      cancelFlush();
    };
  }, [flushMetricsNow, scheduleMetricsFlush, cancelFlush]);

  const send = useCallback((msg: WorkerInMessage) => {
    workerRef.current?.postMessage(msg);
  }, []);

  const init = useCallback((scenario: ScenarioConfig, params?: Partial<SimulationParams>) => {
    cancelFlush();
    metricsRef.current = [];
    fieldsRef.current = null;
    setMetrics([]);
    setTick(0);
    setRunning(false);
    setDone(false);
    send({ type: 'init', scenario, params });
  }, [send, cancelFlush]);

  const play = useCallback((speed: number = 1) => {
    setRunning(true);
    send({ type: 'run', speed });
  }, [send]);

  const pause = useCallback(() => {
    setRunning(false);
    send({ type: 'pause' });
  }, [send]);

  const step = useCallback(() => {
    setRunning(false);
    send({ type: 'step' });
  }, [send]);

  const seek = useCallback((targetTick: number) => {
    setRunning(false);
    // Scrubbing back off the end has to clear `done`, or Play stays disabled
    // for the rest of the session.
    if (targetTick < TOTAL_TICKS) setDone(false);
    send({ type: 'seek', tick: targetTick });
  }, [send]);

  const setOverlay = useCallback((overlay: OverlayMode) => {
    send({ type: 'setOverlay', overlay });
  }, [send]);

  return {
    tick, metrics, running, done,
    subscribeFrame, init, play, pause, step, seek, setOverlay,
  };
}
