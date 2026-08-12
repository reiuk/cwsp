import { memo } from 'react';
import { CompletedRun } from '../lib/runs';
import { c, font, labelStyle } from '../theme';

interface Props {
  runs: CompletedRun[];
  onClear: () => void;
}

export const RunHistory = memo(function RunHistory({ runs, onClear }: Props) {
  if (runs.length === 0) return null;

  return (
    <div style={{ borderTop: `1px solid ${c.lineSoft}`, paddingTop: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={labelStyle}>Completed runs</span>
        <button
          onClick={onClear}
          style={{
            background: 'none',
            border: 'none',
            color: c.faint,
            cursor: 'pointer',
            fontSize: 11,
            fontFamily: 'inherit',
            padding: 0,
          }}
        >
          Clear
        </button>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 7 }}>
        {runs.map((run, i) => {
          const final = run.metrics[run.metrics.length - 1];
          return (
            <div
              key={i}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 8,
                padding: '3px 8px',
                background: c.surfaceHi,
                borderLeft: `2px solid ${run.color}`,
                borderRadius: 3,
                fontSize: 11,
              }}
            >
              <span style={{ color: c.dim, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {run.name}
              </span>
              <span style={{ color: run.color, fontFamily: font.mono, whiteSpace: 'nowrap' }}>
                {final ? `${final.woundClosurePct.toFixed(0)}% closed` : ''}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
});
