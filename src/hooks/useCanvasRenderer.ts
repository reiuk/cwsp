/**
 * Hook for canvas rendering with requestAnimationFrame.
 */

import { useEffect, useRef } from 'react';
import { NX, NY, SimulationFields, OverlayMode } from '../simulation/types';
import { renderGrid } from '../rendering/gridRenderer';

export function useCanvasRenderer(
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  fields: SimulationFields | null,
  overlay: OverlayMode,
  displayWidth: number,
  displayHeight: number,
) {
  const imageDataRef = useRef<ImageData | null>(null);
  const offscreenRef = useRef<HTMLCanvasElement | null>(null);
  const offCtxRef = useRef<CanvasRenderingContext2D | null>(null);

  // Create offscreen canvas for the NX×NY grid
  useEffect(() => {
    const offscreen = document.createElement('canvas');
    offscreen.width = NX;
    offscreen.height = NY;
    offscreenRef.current = offscreen;
    offCtxRef.current = offscreen.getContext('2d')!;
    imageDataRef.current = offCtxRef.current.createImageData(NX, NY);
  }, []);

  // Render on each frame when fields change
  useEffect(() => {
    if (!fields || !canvasRef.current || !offCtxRef.current || !imageDataRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Render to offscreen NX×NY ImageData
    renderGrid(fields, overlay, imageDataRef.current);

    // Put to offscreen canvas
    offCtxRef.current.putImageData(imageDataRef.current, 0, 0);

    // Scale up to display canvas
    canvas.width = displayWidth;
    canvas.height = displayHeight;
    ctx.imageSmoothingEnabled = false; // crisp pixels
    ctx.drawImage(offscreenRef.current!, 0, 0, displayWidth, displayHeight);
  }, [fields, overlay, displayWidth, displayHeight, canvasRef]);
}
