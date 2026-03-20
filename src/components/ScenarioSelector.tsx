import { SCENARIOS } from '../simulation/parameters';
import { ScenarioConfig } from '../simulation/types';

interface Props {
  currentScenario: string;
  onSelect: (key: string, scenario: ScenarioConfig) => void;
}

export function ScenarioSelector({ currentScenario, onSelect }: Props) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <label style={{ color: '#aaa', fontSize: 12, fontWeight: 600 }}>SCENARIO</label>
      {Object.entries(SCENARIOS).map(([key, scenario]) => (
        <button
          key={key}
          onClick={() => onSelect(key, scenario)}
          style={{
            ...scenarioBtnStyle,
            background: key === currentScenario ? '#2a4a7a' : '#2a2a2a',
            borderColor: key === currentScenario ? '#4a8adf' : '#444',
          }}
        >
          <span style={{ fontWeight: 600, fontSize: 13 }}>{scenario.name}</span>
          <span style={{ fontSize: 11, color: '#999' }}>{scenario.description}</span>
        </button>
      ))}
    </div>
  );
}

const scenarioBtnStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'flex-start',
  padding: '8px 12px',
  border: '1px solid #444',
  borderRadius: 4,
  cursor: 'pointer',
  color: '#ddd',
  textAlign: 'left',
  gap: 2,
};
