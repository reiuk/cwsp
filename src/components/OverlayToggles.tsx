import { OverlayMode } from '../simulation/types';

interface Props {
  overlay: OverlayMode;
  onChange: (overlay: OverlayMode) => void;
}

const OVERLAYS: { mode: OverlayMode; label: string }[] = [
  { mode: 'tissue', label: 'Tissue Composition' },
  { mode: 'oxygen', label: 'Oxygen Levels' },
  { mode: 'bacterial', label: 'Bacterial Density' },
  { mode: 'inflammatory', label: 'Inflammatory State' },
  { mode: 'collagen', label: 'Collagen Density' },
];

export function OverlayToggles({ overlay, onChange }: Props) {
  return (
    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
      {OVERLAYS.map(({ mode, label }) => (
        <button
          key={mode}
          onClick={() => onChange(mode)}
          style={{
            padding: '4px 10px',
            fontSize: 12,
            background: mode === overlay ? '#2a4a7a' : '#2a2a2a',
            border: `1px solid ${mode === overlay ? '#4a8adf' : '#444'}`,
            color: '#ddd',
            borderRadius: 3,
            cursor: 'pointer',
          }}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
