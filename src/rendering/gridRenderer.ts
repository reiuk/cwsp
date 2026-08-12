/**
 * Grid renderer: converts simulation fields to ImageData for canvas display.
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
 *
 * The palette is deliberately histological rather than decorative: the collagen
 * matrix that makes up the bulk of the dermis reads as pale connective tissue,
 * so the clot, the epidermis and any bacteria stand out against it instead of
 * competing with a saturated background. Each field still maps to colour the
 * same way it always did; only the target colours changed.
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

      // Base: the debrided void, before anything has filled it
      let r = 26, g = 22, b = 22;

      // Fibrin clot: amber
      if (fib > 0.01) {
        const fi = Math.min(1, fib);
        r += (216 - r) * fi;
        g += (176 - g) * fi;
        b += (72 - b) * fi;
      }

      // Collagen matrix: pale connective tissue, the bulk of the dermis
      if (col > 0.01) {
        const ci = Math.min(1, col) * 0.88;
        r += (176 - r) * ci;
        g += (158 - g) * ci;
        b += (144 - b) * ci;
      }

      // Fibroblasts: slight warm density on top of the matrix
      if (fb > 0.01) {
        const fi = Math.min(1, fb) * 0.18;
        r += (204 - r) * fi;
        g += (150 - g) * fi;
        b += (138 - b) * fi;
      }

      // Vasculature: perfusion reads as a red undertone
      if (vasc > 0.15) {
        const vi = Math.min(1, (vasc - 0.15) * 0.5) * 0.24;
        r += (206 - r) * vi;
        g -= g * vi * 0.32;
        b -= b * vi * 0.32;
      }

      // Keratinocytes: epidermis, distinctly pinker than the dermis below it
      if (kc > 0.01) {
        const ki = Math.min(1, kc);
        r = r * (1 - ki) + 230 * ki;
        g = g * (1 - ki) + 122 * ki;
        b = b * (1 - ki) + 138 * ki;
      }

      // Bacteria: green
      if (bac > 0.01) {
        const bi = Math.min(1, bac) * 0.68;
        r = r * (1 - bi) + 88 * bi;
        g = g * (1 - bi) + 208 * bi;
        b = b * (1 - bi) + 52 * bi;
      }

      // Immune cells: bright specks
      const immune = neut + m1 + m2;
      if (immune > 0.05) {
        const ii = Math.min(1, immune) * 0.45;
        r += (255 - r) * ii;
        g += (252 - g) * ii * 0.8;
        b += (245 - b) * ii * 0.8;
      }

      data[px] = r;
      data[px + 1] = g;
      data[px + 2] = b;
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
