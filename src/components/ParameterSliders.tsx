import { useState } from 'react';
import { ScenarioConfig } from '../simulation/types';
import { createCustomScenario } from '../simulation/scenarios';

interface Props {
  onApply: (scenario: ScenarioConfig) => void;
}

export function ParameterSliders({ onApply }: Props) {
  const [open, setOpen] = useState(false);
  const [bacterialLoad, setBacterialLoad] = useState(0);
  const [vascularDensity, setVascularDensity] = useState(1.0);
  const [abxTiming, setAbxTiming] = useState(0);
  const [abxDose, setAbxDose] = useState(0.8);
  const [abxEnabled, setAbxEnabled] = useState(false);

  const handleApply = () => {
    const scenario = createCustomScenario(
      bacterialLoad,
      vascularDensity,
      abxEnabled ? abxTiming : null,
      abxDose,
    );
    onApply(scenario);
  };

  return (
    <div style={{ borderTop: '1px solid #333', paddingTop: 8 }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          background: 'none',
          border: 'none',
          color: '#8ab',
          cursor: 'pointer',
          fontSize: 12,
          padding: 0,
        }}
      >
        {open ? '▼' : '▶'} Advanced Parameters
      </button>

      {open && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 8 }}>
          <SliderRow
            label="Initial Bacterial Load"
            value={bacterialLoad}
            onChange={setBacterialLoad}
            min={0} max={1} step={0.05}
          />
          <SliderRow
            label="Vascular Density"
            value={vascularDensity}
            onChange={setVascularDensity}
            min={0.1} max={1} step={0.05}
          />
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input
              type="checkbox"
              checked={abxEnabled}
              onChange={e => setAbxEnabled(e.target.checked)}
            />
            <span style={{ color: '#aaa', fontSize: 12 }}>Enable Antibiotic</span>
          </div>
          {abxEnabled && (
            <>
              <SliderRow
                label="Antibiotic Timing (hours)"
                value={abxTiming}
                onChange={setAbxTiming}
                min={0} max={168} step={1}
                displayValue={`${abxTiming}hr (Day ${(abxTiming / 24).toFixed(1)})`}
              />
              <SliderRow
                label="Antibiotic Dose"
                value={abxDose}
                onChange={setAbxDose}
                min={0} max={1} step={0.05}
              />
            </>
          )}
          <button onClick={handleApply} style={applyBtnStyle}>
            Apply & Reset
          </button>
        </div>
      )}
    </div>
  );
}

function SliderRow({
  label, value, onChange, min, max, step, displayValue,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step: number;
  displayValue?: string;
}) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
        <span style={{ color: '#aaa', fontSize: 12 }}>{label}</span>
        <span style={{ color: '#ddd', fontSize: 12, fontFamily: 'monospace' }}>
          {displayValue || value.toFixed(2)}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
        style={{ width: '100%' }}
      />
    </div>
  );
}

const applyBtnStyle: React.CSSProperties = {
  padding: '8px 16px',
  background: '#2a5a2a',
  color: '#eee',
  border: '1px solid #4a8a4a',
  borderRadius: 4,
  cursor: 'pointer',
  fontSize: 13,
};
