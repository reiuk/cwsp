import { useCallback, useEffect, useMemo, useState } from 'react';
import { OverlayMode, ScenarioConfig } from './simulation/types';
import { SCENARIOS } from './simulation/parameters';
import { useSimulation } from './hooks/useSimulation';
import { WoundCanvas } from './components/WoundCanvas';
import { TimelineControls } from './components/TimelineControls';
import { ScenarioSelector } from './components/ScenarioSelector';
import { OverlayToggles } from './components/OverlayToggles';
import { ParameterSliders } from './components/ParameterSliders';
import { ChartPanel } from './components/ChartPanel';
import { CitationFooter } from './components/CitationFooter';
import { RunHistory } from './components/RunHistory';
import { CompletedRun, getNextRunColor } from './lib/runs';
import { c, font, labelStyle } from './theme';

export default function App() {
  // Destructured so the callbacks keep a stable identity: the handle object is
  // new on every render, and depending on it would invalidate every memo below.
  const {
    tick, metrics, running, done,
    subscribeFrame, init, play, pause, step, seek,
  } = useSimulation();
  const [overlay, setOverlay] = useState<OverlayMode>('tissue');
  const [currentScenario, setCurrentScenario] = useState('normal');
  const [currentScenarioName, setCurrentScenarioName] = useState('Normal Acute Wound');
  const [completedRuns, setCompletedRuns] = useState<CompletedRun[]>([]);
  const [speed, setSpeed] = useState(1);

  // Initialize with default scenario on mount
  useEffect(() => {
    init(SCENARIOS.normal);
  }, [init]);

  // Save completed run when simulation finishes. This genuinely is a reaction to
  // the worker reaching the last tick, not derivable state, so the setState here
  // is deliberate.
  useEffect(() => {
    if (done && metrics.length > 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCompletedRuns(prev => [
        ...prev,
        {
          name: currentScenarioName,
          metrics: [...metrics],
          color: getNextRunColor(prev.length),
        },
      ]);
    }
  }, [done]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSelectScenario = useCallback((key: string, scenario: ScenarioConfig) => {
    setCurrentScenario(key);
    setCurrentScenarioName(scenario.name);
    init(scenario);
  }, [init]);

  const handleCustomScenario = useCallback((scenario: ScenarioConfig) => {
    setCurrentScenario('custom');
    setCurrentScenarioName('Custom');
    init(scenario);
  }, [init]);

  // Changing speed mid-run retargets the running loop rather than restarting it.
  const handleSpeedChange = useCallback((next: number) => {
    setSpeed(next);
    if (running) play(next);
  }, [running, play]);

  const handlePlay = useCallback(() => play(speed), [play, speed]);
  const handleClearRuns = useCallback(() => setCompletedRuns([]), []);

  const latest = metrics.length ? metrics[metrics.length - 1] : null;
  const readout = useMemo(() => ([
    { k: 'closure', v: latest ? `${latest.woundClosurePct.toFixed(0)}%` : '0%' },
    { k: 'bacteria', v: latest ? latest.avgBacterialLoad.toFixed(2) : '0.00' },
    { k: 'O₂', v: latest ? latest.avgOxygen.toFixed(2) : '0.00' },
    { k: 'collagen', v: latest ? latest.avgCollagen.toFixed(2) : '0.00' },
  ]), [latest]);

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100dvh',
      overflow: 'hidden',
      background: c.bg,
      color: c.text,
      fontFamily: font.sans,
    }}>
      {/* Header */}
      <header style={{
        flexShrink: 0,
        padding: '9px 16px',
        borderBottom: `1px solid ${c.line}`,
        background: c.surface,
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        flexWrap: 'wrap',
      }}>
        <h1 style={{
          fontSize: 14,
          fontWeight: 700,
          margin: 0,
          letterSpacing: '0.14em',
          fontFamily: font.mono,
        }}>
          CWSP
        </h1>
        <span style={{ color: c.dim, fontSize: 12.5 }}>
          Wound healing as a reaction-diffusion system: 14 days across a 10 × 5 mm skin cross-section
        </span>

        <div style={{ marginLeft: 'auto', display: 'flex', gap: 14, flexWrap: 'wrap' }}>
          {readout.map(r => (
            <span key={r.k} style={{ display: 'flex', alignItems: 'baseline', gap: 5 }}>
              <span style={{ ...labelStyle, fontSize: 9 }}>{r.k}</span>
              <span style={{ fontFamily: font.mono, fontSize: 12.5, color: c.text }}>{r.v}</span>
            </span>
          ))}
        </div>
      </header>

      {/* Main content */}
      <div style={{
        display: 'flex',
        flex: 1,
        minHeight: 0,
        overflow: 'hidden',
      }}>
        {/* Left panel: the figure and its transport controls */}
        <main style={{
          flex: 1,
          minWidth: 0,
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
          padding: '12px 16px 14px',
          gap: 10,
          overflow: 'hidden',
        }}>
          <WoundCanvas subscribeFrame={subscribeFrame} overlay={overlay} />
          <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <OverlayToggles overlay={overlay} onChange={setOverlay} />
            <TimelineControls
              tick={tick}
              running={running}
              done={done}
              speed={speed}
              onPlay={handlePlay}
              onPause={pause}
              onStep={step}
              onSeek={seek}
              onSpeedChange={handleSpeedChange}
            />
          </div>
        </main>

        {/* Right panel: controls and outcome charts */}
        <aside style={{
          flex: '0 0 328px',
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
          borderLeft: `1px solid ${c.line}`,
          background: c.surface,
          overflowY: 'auto',
          overflowX: 'hidden',
          padding: 12,
          gap: 12,
        }}>
          <ScenarioSelector
            currentScenario={currentScenario}
            onSelect={handleSelectScenario}
          />

          <ParameterSliders onApply={handleCustomScenario} />

          <RunHistory
            runs={completedRuns}
            onClear={handleClearRuns}
          />

          <div style={{ borderTop: `1px solid ${c.lineSoft}`, paddingTop: 10 }}>
            <div style={{ ...labelStyle, marginBottom: 8 }}>Outcome metrics</div>
            <ChartPanel
              currentMetrics={metrics}
              completedRuns={completedRuns}
            />
            <p style={{
              color: c.faint,
              fontSize: 11,
              lineHeight: 1.5,
              margin: '10px 0 0',
            }}>
              Finished runs stay on the charts as dashed lines, so running a second
              scenario overlays it on the first.
            </p>
          </div>
        </aside>
      </div>

      <CitationFooter />
    </div>
  );
}
