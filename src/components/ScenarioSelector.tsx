import { memo } from 'react';
import { SCENARIOS } from '../simulation/parameters';
import { ScenarioConfig } from '../simulation/types';
import { c, labelStyle } from '../theme';

interface Props {
  currentScenario: string;
  onSelect: (key: string, scenario: ScenarioConfig) => void;
}

export const ScenarioSelector = memo(function ScenarioSelector({ currentScenario, onSelect }: Props) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <div style={{ ...labelStyle, marginBottom: 2 }}>Scenario</div>
      {Object.entries(SCENARIOS).map(([key, scenario]) => {
        const active = key === currentScenario;
        return (
          <button
            key={key}
            onClick={() => onSelect(key, scenario)}
            aria-pressed={active}
            style={{
              ...scenarioBtnStyle,
              background: active ? c.accentFill : c.surfaceHi,
              borderColor: active ? c.accentDim : c.line,
            }}
          >
            <span style={{
              fontWeight: 600,
              fontSize: 12.5,
              color: active ? c.accent : c.text,
            }}>
              {scenario.name}
            </span>
            <span style={{ fontSize: 11, color: c.faint, lineHeight: 1.4 }}>
              {scenario.description}
            </span>
          </button>
        );
      })}
    </div>
  );
});

const scenarioBtnStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'flex-start',
  padding: '7px 10px',
  border: '1px solid',
  borderRadius: 5,
  cursor: 'pointer',
  textAlign: 'left',
  gap: 2,
  fontFamily: 'inherit',
};
