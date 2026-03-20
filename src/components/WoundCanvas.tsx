import { useRef, useState, useCallback, useEffect } from 'react';
import { SimulationFields, OverlayMode, NX, NY } from '../simulation/types';
import { useCanvasRenderer } from '../hooks/useCanvasRenderer';

const ASPECT_RATIO = NX / NY; // 2:1

interface Props {
  fields: SimulationFields | null;
  overlay: OverlayMode;
}

export function WoundCanvas({ fields, overlay }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [displaySize, setDisplaySize] = useState({ width: 700, height: 350 });

  const updateSize = useCallback(() => {
    if (!containerRef.current) return;
    const containerWidth = containerRef.current.clientWidth;
    const width = containerWidth;
    const height = Math.round(width / ASPECT_RATIO);
    setDisplaySize({ width, height });
  }, []);

  useEffect(() => {
    updateSize();
    const observer = new ResizeObserver(updateSize);
    if (containerRef.current) observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [updateSize]);

  useCanvasRenderer(canvasRef, fields, overlay, displaySize.width, displaySize.height);

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%' }}>
      <canvas
        ref={canvasRef}
        width={displaySize.width}
        height={displaySize.height}
        style={{
          width: '100%',
          height: displaySize.height,
          border: '1px solid #444',
          borderRadius: 4,
          background: '#1a1a1a',
          display: 'block',
        }}
      />
      <OverlayLegend overlay={overlay} />
    </div>
  );
}

function OverlayLegend({ overlay }: { overlay: OverlayMode }) {
  if (overlay === 'tissue') {
    return (
      <div style={legendStyle}>
        <LegendItem color="#dc8c96" label="Keratinocytes" />
        <LegendItem color="#6864d2" label="Collagen" />
        <LegendItem color="#dcbe32" label="Fibrin" />
        <LegendItem color="#50dc28" label="Bacteria" />
        <LegendItem color="#ffffff" label="Immune cells" />
      </div>
    );
  }

  const labels: Record<string, [string, string]> = {
    oxygen: ['Low O₂', 'High O₂'],
    bacterial: ['None', 'High'],
    inflammatory: ['Low TNF-α', 'High TNF-α'],
    collagen: ['None', 'Dense'],
  };
  const [low, high] = labels[overlay] || ['Low', 'High'];

  return (
    <div style={legendStyle}>
      <span style={{ fontSize: 11, color: '#aaa' }}>{low}</span>
      <div style={{
        width: 100, height: 12,
        background: overlay === 'oxygen'
          ? 'linear-gradient(to right, #1e3cc8, #dc2828)'
          : overlay === 'bacterial'
            ? 'linear-gradient(to right, #141414, #c8dc1e)'
            : overlay === 'inflammatory'
              ? 'linear-gradient(to right, #2828b4, #e63232)'
              : 'linear-gradient(to right, #141428, #6450dc)',
        borderRadius: 2,
      }} />
      <span style={{ fontSize: 11, color: '#aaa' }}>{high}</span>
    </div>
  );
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      <div style={{ width: 10, height: 10, background: color, borderRadius: 2 }} />
      <span style={{ fontSize: 11, color: '#ccc' }}>{label}</span>
    </div>
  );
}

const legendStyle: React.CSSProperties = {
  display: 'flex',
  gap: 12,
  alignItems: 'center',
  marginTop: 6,
  padding: '4px 8px',
  background: 'rgba(0,0,0,0.5)',
  borderRadius: 4,
  flexWrap: 'wrap',
};
