/**
 * Hook for managing the simulation worker lifecycle.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  SimulationFields, ScenarioConfig, TickMetrics,
  WorkerInMessage, WorkerOutMessage,
  OverlayMode, SimulationParams,
} from '../simulation/types';
import { bufferToFields } from '../simulation/fields';

export interface SimulationHandle {
  fields: SimulationFields | null;
  tick: number;
  metrics: TickMetrics[];
  running: boolean;
  done: boolean;
  init: (scenario: ScenarioConfig, params?: Partial<SimulationParams>) => void;
  play: (speed?: number) => void;
  pause: () => void;
  step: () => void;
  seek: (tick: number) => void;
  setOverlay: (overlay: OverlayMode) => void;
}

export function useSimulation(): SimulationHandle {
  const workerRef = useRef<Worker | null>(null);
  const [fields, setFields] = useState<SimulationFields | null>(null);
  const [tick, setTick] = useState(0);
  const [metrics, setMetrics] = useState<TickMetrics[]>([]);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);

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
          // Reconstruct fields from transferred buffer
          const newFields = bufferToFields(msg.buffer);
          setFields(newFields);
          setTick(msg.tick);
          setMetrics(prev => {
            // Append or replace (for seek operations)
            if (prev.length > 0 && prev[prev.length - 1].tick >= msg.tick) {
              // Seeking backwards — trim metrics
              const trimmed = prev.filter(m => m.tick < msg.tick);
              return [...trimmed, msg.metrics];
            }
            return [...prev, msg.metrics];
          });
          break;
        }
        case 'done':
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
    };
  }, []);

  const send = useCallback((msg: WorkerInMessage) => {
    workerRef.current?.postMessage(msg);
  }, []);

  const init = useCallback((scenario: ScenarioConfig, params?: Partial<SimulationParams>) => {
    setMetrics([]);
    setTick(0);
    setFields(null);
    setRunning(false);
    setDone(false);
    send({ type: 'init', scenario, params });
  }, [send]);

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
    send({ type: 'seek', tick: targetTick });
  }, [send]);

  const setOverlay = useCallback((overlay: OverlayMode) => {
    send({ type: 'setOverlay', overlay });
  }, [send]);

  return { fields, tick, metrics, running, done, init, play, pause, step, seek, setOverlay };
}
