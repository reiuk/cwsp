import { useCallback, useEffect, useState } from 'react';
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
import { RunHistory, CompletedRun, getNextRunColor } from './components/RunHistory';

export default function App() {
  const sim = useSimulation();
  const [overlay, setOverlay] = useState<OverlayMode>('tissue');
  const [currentScenario, setCurrentScenario] = useState('normal');
  const [currentScenarioName, setCurrentScenarioName] = useState('Normal Acute Wound');
  const [completedRuns, setCompletedRuns] = useState<CompletedRun[]>([]);

  // Initialize with default scenario on mount
  useEffect(() => {
    sim.init(SCENARIOS.normal);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Save completed run when simulation finishes
  useEffect(() => {
    if (sim.done && sim.metrics.length > 0) {
      setCompletedRuns(prev => [
        ...prev,
        {
          name: currentScenarioName,
          metrics: [...sim.metrics],
          color: getNextRunColor(prev.length),
        },
      ]);
    }
  }, [sim.done]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSelectScenario = useCallback((key: string, scenario: ScenarioConfig) => {
    setCurrentScenario(key);
    setCurrentScenarioName(scenario.name);
    sim.init(scenario);
  }, [sim]);

  const handleCustomScenario = useCallback((scenario: ScenarioConfig) => {
    setCurrentScenario('custom');
    setCurrentScenarioName('Custom');
    sim.init(scenario);
  }, [sim]);

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      background: '#1a1a1a',
      color: '#eee',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    }}>
      {/* Header */}
      <div style={{
        padding: '10px 16px',
        borderBottom: '1px solid #333',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
      }}>
        <h1 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>
          CWSP Wound Healing Simulation
        </h1>
        <span style={{ color: '#888', fontSize: 13 }}>
          2D cross-section — reaction-diffusion model
        </span>
      </div>

      {/* Main content */}
      <div style={{
        display: 'flex',
        flex: 1,
        overflow: 'hidden',
      }}>
        {/* Left panel: Canvas */}
        <div style={{
          flex: 1,
          minWidth: 0,
          display: 'flex',
          flexDirection: 'column',
          padding: 16,
          gap: 12,
        }}>
          <WoundCanvas fields={sim.fields} overlay={overlay} />
          <OverlayToggles overlay={overlay} onChange={setOverlay} />
          <TimelineControls
            tick={sim.tick}
            running={sim.running}
            done={sim.done}
            onPlay={sim.play}
            onPause={sim.pause}
            onStep={sim.step}
            onSeek={sim.seek}
          />
        </div>

        {/* Right panel: Controls + Charts */}
        <div style={{
          flex: '0 0 340px',
          display: 'flex',
          flexDirection: 'column',
          borderLeft: '1px solid #333',
          overflow: 'auto',
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
            onClear={() => setCompletedRuns([])}
          />

          <div style={{ borderTop: '1px solid #333', paddingTop: 8 }}>
            <div style={{ color: '#aaa', fontSize: 12, fontWeight: 600, marginBottom: 6 }}>
              OUTCOME METRICS
            </div>
            <ChartPanel
              currentMetrics={sim.metrics}
              completedRuns={completedRuns}
            />
          </div>
        </div>
      </div>

      <CitationFooter />
    </div>
  );
}
