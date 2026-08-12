/**
 * Draws the wound figure: the simulation grid plus the annotation furniture that
 * makes it readable as a tissue cross-section (mm axes, the original defect
 * outline, tissue layer markers).
 *
 * Everything is drawn in device pixels so the 100x50 grid lands on an exact
 * integer number of pixels per cell, which keeps the cells crisp and uniform
 * instead of aliasing into uneven stripes.
 *
 * Frames arrive by subscription, not as props, and redraws are coalesced onto
 * requestAnimationFrame. The canvas therefore repaints at most once per display
 * refresh no matter how fast the worker runs, and never re-renders React.
 */

import { useCallback, useEffect, useRef } from 'react';
import { NX, NY, SimulationFields, OverlayMode } from '../simulation/types';
import { renderGrid } from '../rendering/gridRenderer';
import type { FrameListener } from './useSimulation';
import { c, font } from '../theme';

/** Physical size of one grid cell, per the model geometry. */
export const MM_PER_CELL = 0.1;
export const DOMAIN_W_MM = NX * MM_PER_CELL; // 10mm
export const DOMAIN_H_MM = NY * MM_PER_CELL; // 5mm

/** Wound geometry, mirroring `woundLeft/woundRight/woundDepth` in parameters.ts. */
export const WOUND = { left: 15, right: 85, depth: 25, epidermisRows: 2 };

/** Margins around the plot area, in CSS pixels. */
const M = { top: 12, right: 14, bottom: 26, left: 34 };

/** Upper bound on cell size so the figure stays a figure on a large display. */
const MAX_CELL_CSS = 11;

export interface FigureGeometry {
  /** Canvas size in CSS pixels. */
  cssWidth: number;
  cssHeight: number;
  /** Cell size in CSS pixels. */
  cell: number;
}

/**
 * Fit a 2:1 figure with integer cell size into the available box.
 * Returns null when there is not enough room to draw anything meaningful.
 */
export function fitFigure(availW: number, availH: number, dpr: number): FigureGeometry | null {
  const innerW = availW - M.left - M.right;
  const innerH = availH - M.top - M.bottom;
  if (innerW < 40 || innerH < 20) return null;

  // Choose the cell size in device pixels so cells are pixel-exact.
  const maxCellDev = Math.min(innerW * dpr / NX, innerH * dpr / NY, MAX_CELL_CSS * dpr);
  const cellDev = Math.max(1, Math.floor(maxCellDev));
  const cell = cellDev / dpr;

  return {
    cssWidth: cell * NX + M.left + M.right,
    cssHeight: cell * NY + M.top + M.bottom,
    cell,
  };
}

export function useCanvasRenderer(
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  subscribeFrame: (listener: FrameListener) => () => void,
  overlay: OverlayMode,
  geom: FigureGeometry | null,
) {
  const offscreenRef = useRef<HTMLCanvasElement | null>(null);
  const offCtxRef = useRef<CanvasRenderingContext2D | null>(null);
  const imageDataRef = useRef<ImageData | null>(null);

  // Draw inputs live in refs so a new frame never has to touch React.
  const fieldsRef = useRef<SimulationFields | null>(null);
  const overlayRef = useRef(overlay);
  const geomRef = useRef(geom);
  const rafRef = useRef<number | null>(null);

  const draw = useCallback(() => {
    rafRef.current = null;

    const canvas = canvasRef.current;
    const geom = geomRef.current;
    if (!canvas || !geom) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (!offCtxRef.current) {
      const offscreen = document.createElement('canvas');
      offscreen.width = NX;
      offscreen.height = NY;
      offscreenRef.current = offscreen;
      offCtxRef.current = offscreen.getContext('2d')!;
      imageDataRef.current = offCtxRef.current.createImageData(NX, NY);
    }

    const overlay = overlayRef.current;
    const fields = fieldsRef.current;

    const dpr = window.devicePixelRatio || 1;
    const W = Math.round(geom.cssWidth * dpr);
    const H = Math.round(geom.cssHeight * dpr);
    if (canvas.width !== W) canvas.width = W;
    if (canvas.height !== H) canvas.height = H;

    const px = (v: number) => v * dpr;
    const plot = {
      x: Math.round(px(M.left)),
      y: Math.round(px(M.top)),
      w: Math.round(px(geom.cell) * NX),
      h: Math.round(px(geom.cell) * NY),
    };

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = c.bg;
    ctx.fillRect(0, 0, W, H);

    // --- field image ---
    if (fields) {
      renderGrid(fields, overlay, imageDataRef.current!);
      offCtxRef.current.putImageData(imageDataRef.current!, 0, 0);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(offscreenRef.current!, plot.x, plot.y, plot.w, plot.h);
    } else {
      ctx.fillStyle = c.surface;
      ctx.fillRect(plot.x, plot.y, plot.w, plot.h);
    }

    drawAnnotations(ctx, plot, dpr, overlay);
  }, [canvasRef]);

  /** Coalesce every redraw request onto the next animation frame, so a burst of
   *  worker frames costs one paint, not one paint each. */
  const schedule = useCallback(() => {
    if (rafRef.current !== null) return;
    rafRef.current = requestAnimationFrame(draw);
  }, [draw]);

  // Redraw when the figure itself changes.
  useEffect(() => {
    overlayRef.current = overlay;
    geomRef.current = geom;
    schedule();
  }, [overlay, geom, schedule]);

  // Redraw when the worker sends a frame.
  useEffect(() => subscribeFrame(fields => {
    fieldsRef.current = fields;
    schedule();
  }), [subscribeFrame, schedule]);

  useEffect(() => () => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      // Clearing this matters: StrictMode unmounts and remounts, and a stale
      // handle left here makes `schedule` think a draw is already pending, so
      // the canvas would never paint again.
      rafRef.current = null;
    }
  }, []);
}

type Rect = { x: number; y: number; w: number; h: number };

function drawAnnotations(
  ctx: CanvasRenderingContext2D,
  plot: Rect,
  dpr: number,
  overlay: OverlayMode,
) {
  const px = (v: number) => v * dpr;
  const cellW = plot.w / NX;
  const cellH = plot.h / NY;
  const hair = Math.max(1, Math.round(px(1)));

  ctx.lineCap = 'butt';
  ctx.textBaseline = 'middle';

  // --- original defect outline -------------------------------------------
  // Drawn on every overlay: it is the reference against which closure reads.
  const wx = plot.x + WOUND.left * cellW;
  const wy = plot.y;
  const ww = (WOUND.right - WOUND.left) * cellW;
  const wh = WOUND.depth * cellH;

  ctx.save();
  ctx.setLineDash([px(4), px(4)]);
  ctx.lineWidth = hair;
  ctx.strokeStyle = 'rgba(255,255,255,0.45)';
  ctx.strokeRect(
    Math.round(wx) + hair / 2,
    Math.round(wy) + hair / 2,
    Math.round(ww) - hair,
    Math.round(wh) - hair,
  );
  ctx.restore();

  // --- epidermis marker ---------------------------------------------------
  // The epidermis is only 2 of 50 rows, so it needs a bracket to be findable.
  if (overlay === 'tissue') {
    const epiY = plot.y + WOUND.epidermisRows * cellH;
    ctx.save();
    ctx.lineWidth = hair;
    ctx.strokeStyle = 'rgba(255,255,255,0.28)';
    ctx.beginPath();
    ctx.moveTo(plot.x, Math.round(epiY) + hair / 2);
    ctx.lineTo(plot.x + plot.w, Math.round(epiY) + hair / 2);
    ctx.stroke();
    ctx.restore();
  }

  // --- plot frame ---------------------------------------------------------
  ctx.lineWidth = hair;
  ctx.strokeStyle = c.line;
  ctx.strokeRect(plot.x + hair / 2, plot.y + hair / 2, plot.w - hair, plot.h - hair);

  // --- axes ---------------------------------------------------------------
  const tickFont = `${Math.round(px(9))}px ${font.mono}`;
  ctx.fillStyle = c.faint;
  ctx.strokeStyle = c.line;

  // bottom: width in mm
  ctx.font = tickFont;
  ctx.textAlign = 'center';
  for (let mm = 0; mm <= DOMAIN_W_MM; mm += 2) {
    const x = plot.x + (mm / MM_PER_CELL) * cellW;
    const xr = Math.round(Math.min(x, plot.x + plot.w - hair));
    ctx.beginPath();
    ctx.moveTo(xr + hair / 2, plot.y + plot.h);
    ctx.lineTo(xr + hair / 2, plot.y + plot.h + px(4));
    ctx.stroke();
    ctx.fillText(String(mm), xr, plot.y + plot.h + px(13));
  }

  // left: depth in mm
  ctx.textAlign = 'right';
  for (let mm = 0; mm <= DOMAIN_H_MM; mm += 1) {
    const y = plot.y + (mm / MM_PER_CELL) * cellH;
    const yr = Math.round(Math.min(y, plot.y + plot.h - hair));
    ctx.beginPath();
    ctx.moveTo(plot.x - px(4), yr + hair / 2);
    ctx.lineTo(plot.x, yr + hair / 2);
    ctx.stroke();
    ctx.fillText(String(mm), plot.x - px(7), yr);
  }

  // Unit, once, in the corner between the two axes.
  ctx.fillText('mm', plot.x - px(7), plot.y + plot.h + px(13));
}
