/**
 * Grid renderer — converts simulation fields to ImageData for canvas display.
 *
 * For each overlay mode, reads different fields and maps through color LUTs.
 */

import { NX, NY, NCELLS, SimulationFields, FieldName, OverlayMode } from '../simulation/types';
import {
  oxygenLUT, bacterialLUT, inflammatoryLUT, collagenLUT,
  lookupColor, ColorLUT,
} from './colorMaps';

/**
 * Render tissue composite view.
 * Blends keratinocytes (pink), collagen (blue), fibrin (yellow),
 * fibroblasts (light purple), bacteria (green), immune cells (white dots).
 */
function renderTissueView(fields: SimulationFields, imageData: ImageData): void {
  const data = imageData.data;

  for (let y = 0; y < NY; y++) {
    for (let x = 0; x < NX; x++) {
      const idx = y * NX + x;
      const px = idx * 4;

      const kc = fields.keratinocyte[idx];
      const fb = fields.fibroblast[idx];
      const col = fields.collagen[idx];
      const fib = fields.fibrin[idx];
      const bac = fields.bacterialLoad[idx] + fields.biofilmLoad[idx];
      const neut = fields.neutrophil[idx];
      const m1 = fields.macrophageM1[idx];
      const m2 = fields.macrophageM2[idx];
      const vasc = fields.vascularDensity[idx];

      // Base: dark background for wound, tan for dermis
      let r = 30, g = 25, b = 25;

      // Fibrin clot: yellow
      if (fib > 0.01) {
        r = Math.round(r + (220 - r) * fib);
        g = Math.round(g + (190 - g) * fib);
        b = Math.round(b + (50 - b) * fib);
      }

      // Collagen: blue-purple
      if (col > 0.01) {
        const ci = Math.min(1, col);
        r = Math.round(r * (1 - ci * 0.3) + 120 * ci * 0.3);
        g = Math.round(g * (1 - ci * 0.3) + 100 * ci * 0.3);
        b = Math.round(b * (1 - ci * 0.5) + 210 * ci * 0.5);
      }

      // Fibroblasts: subtle warm tint
      if (fb > 0.01) {
        const fi = Math.min(1, fb) * 0.3;
        r = Math.round(r + (180 - r) * fi);
        g = Math.round(g + (140 - g) * fi);
        b = Math.round(b + (160 - b) * fi);
      }

      // Keratinocytes: pink/red (epidermis)
      if (kc > 0.01) {
        const ki = Math.min(1, kc);
        r = Math.round(r * (1 - ki) + 220 * ki);
        g = Math.round(g * (1 - ki) + 140 * ki);
        b = Math.round(b * (1 - ki) + 150 * ki);
      }

      // Vasculature: red tint
      if (vasc > 0.15) {
        const vi = Math.min(1, (vasc - 0.15) * 0.15);
        r = Math.min(255, Math.round(r + 60 * vi));
        g = Math.round(g * (1 - vi * 0.3));
        b = Math.round(b * (1 - vi * 0.3));
      }

      // Bacteria: green overlay
      if (bac > 0.01) {
        const bi = Math.min(1, bac) * 0.6;
        r = Math.round(r * (1 - bi) + 80 * bi);
        g = Math.round(g * (1 - bi) + 220 * bi);
        b = Math.round(b * (1 - bi) + 40 * bi);
      }

      // Immune cells: bright white spots (if significant)
      const immune = neut + m1 + m2;
      if (immune > 0.05) {
        const ii = Math.min(1, immune) * 0.4;
        r = Math.min(255, Math.round(r + (255 - r) * ii));
        g = Math.min(255, Math.round(g + (255 - g) * ii * 0.7));
        b = Math.min(255, Math.round(b + (255 - b) * ii * 0.7));
      }

      data[px] = Math.min(255, r);
      data[px + 1] = Math.min(255, g);
      data[px + 2] = Math.min(255, b);
      data[px + 3] = 255;
    }
  }
}

/**
 * Render a single-field heatmap using a LUT.
 */
function renderHeatmap(
  fields: SimulationFields,
  fieldName: FieldName,
  lut: ColorLUT,
  imageData: ImageData,
  maxVal: number = 1.0,
  secondField?: FieldName,
): void {
  const data = imageData.data;
  const field = fields[fieldName];
  const field2 = secondField ? fields[secondField] : null;

  for (let i = 0; i < NCELLS; i++) {
    const val = field2
      ? Math.min(1, (field[i] + field2[i]) / maxVal)
      : Math.min(1, field[i] / maxVal);
    const [r, g, b, a] = lookupColor(lut, val);
    data[i * 4] = r;
    data[i * 4 + 1] = g;
    data[i * 4 + 2] = b;
    data[i * 4 + 3] = a;
  }
}

/**
 * Render the grid to an ImageData object for the given overlay mode.
 */
export function renderGrid(
  fields: SimulationFields,
  overlay: OverlayMode,
  imageData: ImageData,
): void {
  switch (overlay) {
    case 'tissue':
      renderTissueView(fields, imageData);
      break;
    case 'oxygen':
      renderHeatmap(fields, 'oxygen', oxygenLUT, imageData);
      break;
    case 'bacterial':
      renderHeatmap(fields, 'bacterialLoad', bacterialLUT, imageData, 0.5, 'biofilmLoad');
      break;
    case 'inflammatory':
      renderHeatmap(fields, 'tnfAlpha', inflammatoryLUT, imageData, 0.5);
      break;
    case 'collagen':
      renderHeatmap(fields, 'collagen', collagenLUT, imageData);
      break;
  }
}
