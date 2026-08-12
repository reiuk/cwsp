import { memo } from 'react';
import { OverlayMode } from '../simulation/types';
import { c, labelStyle } from '../theme';

interface Props {
  overlay: OverlayMode;
  onChange: (overlay: OverlayMode) => void;
}

const OVERLAYS: { mode: OverlayMode; label: string }[] = [
  { mode: 'tissue', label: 'Tissue' },
  { mode: 'oxygen', label: 'Oxygen' },
  { mode: 'bacterial', label: 'Bacteria' },
  { mode: 'inflammatory', label: 'Inflammation' },
  { mode: 'collagen', label: 'Collagen' },
];

export const OverlayToggles = memo(function OverlayToggles({ overlay, onChange }: Props) {
  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
      <span style={labelStyle}>View</span>
      <div style={{
        display: 'inline-flex',
        border: `1px solid ${c.line}`,
        borderRadius: 5,
        overflow: 'hidden',
      }}>
        {OVERLAYS.map(({ mode, label }, i) => {
          const active = mode === overlay;
          return (
            <button
              key={mode}
              onClick={() => onChange(mode)}
              aria-pressed={active}
              style={{
                padding: '5px 12px',
                fontSize: 12,
                fontFamily: 'inherit',
                background: active ? c.accentFill : 'transparent',
                color: active ? c.accent : c.dim,
                // Weight is held constant so the control does not reflow as
                // the selection moves between labels.
                fontWeight: 500,
                border: 'none',
                borderLeft: i === 0 ? 'none' : `1px solid ${c.line}`,
                cursor: 'pointer',
              }}
            >
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
});
