import { memo, useRef, useState, useCallback, useEffect } from 'react';
import { OverlayMode } from '../simulation/types';
import {
  useCanvasRenderer, fitFigure, FigureGeometry,
  DOMAIN_W_MM, DOMAIN_H_MM, MM_PER_CELL, WOUND,
} from '../hooks/useCanvasRenderer';
import type { FrameListener } from '../hooks/useSimulation';
import { c, font } from '../theme';

interface Props {
  subscribeFrame: (listener: FrameListener) => () => void;
  overlay: OverlayMode;
}

const woundWmm = (WOUND.right - WOUND.left) * MM_PER_CELL;
const woundDmm = WOUND.depth * MM_PER_CELL;

/** Memoized: playback must never re-render this component. Frames reach the
 *  canvas through `subscribeFrame`, which is stable for the life of the app. */
export const WoundCanvas = memo(function WoundCanvas({ subscribeFrame, overlay }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const [geom, setGeom] = useState<FigureGeometry | null>(null);

  // The figure is a follower of the space it is given: it never sets its own
  // height from its own width, which is what used to push the page past 100vh.
  const measure = useCallback(() => {
    const box = boxRef.current;
    if (!box) return;
    const next = fitFigure(box.clientWidth, box.clientHeight, window.devicePixelRatio || 1);
    setGeom(prev => {
      if (prev && next && prev.cell === next.cell
        && prev.cssWidth === next.cssWidth && prev.cssHeight === next.cssHeight) return prev;
      return next;
    });
  }, []);

  useEffect(() => {
    measure();
    const observer = new ResizeObserver(measure);
    if (boxRef.current) observer.observe(boxRef.current);
    window.addEventListener('resize', measure);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [measure]);

  useCanvasRenderer(canvasRef, subscribeFrame, overlay, geom);

  return (
    <div style={{
      flex: 1,
      minHeight: 0,
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
    }}>
      <div
        ref={boxRef}
        style={{
          flex: 1,
          minHeight: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
        }}
      >
        <canvas
          ref={canvasRef}
          style={{
            width: geom ? geom.cssWidth : 0,
            height: geom ? geom.cssHeight : 0,
            display: 'block',
          }}
        />
        {!geom && (
          <span style={{ color: c.faint, fontSize: 11.5, textAlign: 'center' }}>
            Not enough room to draw the section. Give the window more height.
          </span>
        )}
      </div>

      <div style={{
        display: 'flex',
        alignItems: 'baseline',
        justifyContent: 'space-between',
        gap: 16,
        flexWrap: 'wrap',
      }}>
        <OverlayLegend overlay={overlay} />
        <span style={{
          color: c.faint,
          fontSize: 10.5,
          fontFamily: font.mono,
          whiteSpace: 'nowrap',
        }}>
          {DOMAIN_W_MM} × {DOMAIN_H_MM} mm section · {MM_PER_CELL} mm/cell
        </span>
      </div>
    </div>
  );
});

function OverlayLegend({ overlay }: { overlay: OverlayMode }) {
  const defect = (
    <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
      <span style={{
        width: 14,
        borderTop: `1px dashed rgba(255,255,255,0.55)`,
        display: 'inline-block',
      }} />
      <span style={{ fontSize: 11, color: c.dim }}>
        initial defect ({woundWmm} × {woundDmm} mm)
      </span>
    </span>
  );

  if (overlay === 'tissue') {
    return (
      <div style={legendStyle}>
        <LegendSwatch color="#e67a8a" label="Keratinocytes" />
        <LegendSwatch color="#b09e90" label="Collagen" />
        <LegendSwatch color="#d8b048" label="Fibrin" />
        <LegendSwatch color="#58d034" label="Bacteria" />
        <LegendSwatch color="#ffffff" label="Immune cells" />
        {defect}
      </div>
    );
  }

  const labels: Record<string, [string, string]> = {
    oxygen: ['Low O₂', 'High O₂'],
    bacterial: ['None', 'High'],
    inflammatory: ['Low TNF-α', 'High TNF-α'],
    collagen: ['None', 'Dense'],
  };
  const gradients: Record<string, string> = {
    oxygen: 'linear-gradient(to right, #1e3cc8, #dc2828)',
    bacterial: 'linear-gradient(to right, #141414, #c8dc1e)',
    inflammatory: 'linear-gradient(to right, #2828b4, #e63232)',
    collagen: 'linear-gradient(to right, #141428, #6450dc)',
  };
  const [low, high] = labels[overlay] || ['Low', 'High'];

  return (
    <div style={legendStyle}>
      <span style={{ fontSize: 11, color: c.dim }}>{low}</span>
      <div style={{
        width: 110,
        height: 10,
        background: gradients[overlay],
        borderRadius: 2,
        border: `1px solid ${c.line}`,
      }} />
      <span style={{ fontSize: 11, color: c.dim }}>{high}</span>
      {defect}
    </div>
  );
}

function LegendSwatch({ color, label }: { color: string; label: string }) {
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
      <span style={{
        width: 9,
        height: 9,
        background: color,
        borderRadius: 2,
        display: 'inline-block',
      }} />
      <span style={{ fontSize: 11, color: c.dim }}>{label}</span>
    </span>
  );
}

const legendStyle: React.CSSProperties = {
  display: 'flex',
  gap: 14,
  alignItems: 'center',
  flexWrap: 'wrap',
};
