import { memo, useState } from 'react';
import { ScenarioConfig } from '../simulation/types';
import { createCustomScenario } from '../simulation/scenarios';
import { c, font, labelStyle } from '../theme';

interface Props {
  onApply: (scenario: ScenarioConfig) => void;
}

export const ParameterSliders = memo(function ParameterSliders({ onApply }: Props) {
  const [open, setOpen] = useState(false);
  const [bacterialLoad, setBacterialLoad] = useState(0);
  const [vascularDensity, setVascularDensity] = useState(1.0);
  const [abxTiming, setAbxTiming] = useState(0);
  const [abxDose, setAbxDose] = useState(0.8);
  const [abxEnabled, setAbxEnabled] = useState(false);

  const handleApply = () => {
    onApply(createCustomScenario(
      bacterialLoad,
      vascularDensity,
      abxEnabled ? abxTiming : null,
      abxDose,
    ));
  };

  return (
    <div style={{ borderTop: `1px solid ${c.lineSoft}`, paddingTop: 10 }}>
      <button
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        style={{
          background: 'none',
          border: 'none',
          color: c.dim,
          cursor: 'pointer',
          padding: 0,
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          ...labelStyle,
        }}
      >
        <span style={{ color: c.accent }}>{open ? '−' : '+'}</span>
        Build your own
      </button>

      {open && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 11, marginTop: 10 }}>
          <SliderRow
            label="Initial bacterial load"
            value={bacterialLoad}
            onChange={setBacterialLoad}
            min={0} max={1} step={0.05}
          />
          <SliderRow
            label="Vascular density"
            value={vascularDensity}
            onChange={setVascularDensity}
            min={0.1} max={1} step={0.05}
          />
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={abxEnabled}
              onChange={e => setAbxEnabled(e.target.checked)}
            />
            <span style={{ color: c.dim, fontSize: 12 }}>Give an antibiotic</span>
          </label>
          {abxEnabled && (
            <>
              <SliderRow
                label="Time of first dose"
                value={abxTiming}
                onChange={setAbxTiming}
                min={0} max={168} step={1}
                displayValue={`${abxTiming}h · day ${(abxTiming / 24).toFixed(1)}`}
              />
              <SliderRow
                label="Dose"
                value={abxDose}
                onChange={setAbxDose}
                min={0} max={1} step={0.05}
              />
            </>
          )}
          <button onClick={handleApply} style={applyBtnStyle}>
            Apply and reset
          </button>
        </div>
      )}
    </div>
  );
});

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
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{ color: c.dim, fontSize: 12 }}>{label}</span>
        <span style={{ color: c.text, fontSize: 11.5, fontFamily: font.mono }}>
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
        style={{ width: '100%', display: 'block' }}
        aria-label={label}
      />
    </div>
  );
}

const applyBtnStyle: React.CSSProperties = {
  padding: '7px 14px',
  background: c.accentFill,
  color: c.accent,
  border: `1px solid ${c.accentDim}`,
  borderRadius: 4,
  cursor: 'pointer',
  fontSize: 12,
  fontWeight: 600,
  fontFamily: 'inherit',
};
