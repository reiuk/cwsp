import { TickMetrics } from '../simulation/types';

export interface CompletedRun {
  name: string;
  metrics: TickMetrics[];
  color: string;
}

const RUN_COLORS = ['#e74c3c', '#2ecc71', '#f39c12', '#9b59b6', '#1abc9c'];

interface Props {
  runs: CompletedRun[];
  onClear: () => void;
}

export function RunHistory({ runs, onClear }: Props) {
  if (runs.length === 0) return null;

  return (
    <div style={{ borderTop: '1px solid #333', paddingTop: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ color: '#aaa', fontSize: 12, fontWeight: 600 }}>COMPLETED RUNS</span>
        <button
          onClick={onClear}
          style={{
            background: 'none',
            border: 'none',
            color: '#888',
            cursor: 'pointer',
            fontSize: 11,
          }}
        >
          Clear All
        </button>
      </div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
        {runs.map((run, i) => (
          <div
            key={i}
            style={{
              padding: '3px 8px',
              background: '#2a2a2a',
              border: `1px solid ${run.color}`,
              borderRadius: 12,
              fontSize: 11,
              color: run.color,
            }}
          >
            {run.name}
          </div>
        ))}
      </div>
    </div>
  );
}

export function getNextRunColor(index: number): string {
  return RUN_COLORS[index % RUN_COLORS.length];
}
