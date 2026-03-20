/**
 * Field allocation and wound geometry initialization.
 */

import {
  NX, NY, NCELLS, FIELD_NAMES, FieldName,
  SimulationFields, TissueType,
} from './types';
import { SimulationParams, ScenarioConfig } from './types';

/** Allocate all fields as zeroed Float64Arrays */
export function allocateFields(): SimulationFields {
  const fields = {} as SimulationFields;
  for (const name of FIELD_NAMES) {
    fields[name] = new Float64Array(NCELLS);
  }
  return fields;
}

/** Create tissue type map */
export function createTissueMap(params: SimulationParams): Uint8Array {
  const map = new Uint8Array(NCELLS);
  const { woundLeft, woundRight, woundDepth, epidermisRows } = params;

  for (let y = 0; y < NY; y++) {
    for (let x = 0; x < NX; x++) {
      const idx = y * NX + x;
      const inWoundX = x >= woundLeft && x < woundRight;
      const inWoundY = y < woundDepth;

      if (inWoundX && inWoundY) {
        if (y < epidermisRows) {
          map[idx] = TissueType.WoundSurface;
        } else {
          map[idx] = TissueType.WoundBed;
        }
      } else if (y < epidermisRows) {
        map[idx] = TissueType.Epidermis;
      } else {
        map[idx] = TissueType.Dermis;
      }
    }
  }
  return map;
}

/** Smooth transition function for wound margins (sigmoid over ~3 cells) */
function marginGradient(x: number, center: number, width: number): number {
  return 1 / (1 + Math.exp(-(x - center) / width));
}

/**
 * Initialize all fields for a given scenario.
 * Sets up wound geometry with smooth gradients at margins.
 */
export function initializeFields(
  fields: SimulationFields,
  params: SimulationParams,
  scenario: ScenarioConfig,
): void {
  const { woundLeft, woundRight, woundDepth, epidermisRows } = params;
  const woundCenterX = (woundLeft + woundRight) / 2;
  const woundWidthHalf = (woundRight - woundLeft) / 2;
  const marginWidth = 1.5; // gradient over ~3 cells

  for (let y = 0; y < NY; y++) {
    for (let x = 0; x < NX; x++) {
      const idx = y * NX + x;

      // Compute smooth wound factor: 0 = intact tissue, 1 = wound center
      // Horizontal: smooth sigmoid at wound edges
      const distFromCenter = Math.abs(x - woundCenterX);
      const hFactor = 1 - marginGradient(distFromCenter, woundWidthHalf - marginWidth, marginWidth);

      // Vertical: smooth at wound base
      const vFactor = y < woundDepth - 2
        ? 1.0
        : y < woundDepth + 2
          ? 1 - marginGradient(y, woundDepth - 0.5, marginWidth)
          : 0.0;

      // Combined wound factor
      const inWoundX = x >= woundLeft && x < woundRight;
      const wf = inWoundX ? hFactor * vFactor : 0;

      // --- Structural fields ---
      const isEpidermis = y < epidermisRows;

      // Keratinocytes: present in intact epidermis, absent in wound surface
      if (isEpidermis) {
        fields.keratinocyte[idx] = 1.0 - wf;
      } else {
        fields.keratinocyte[idx] = 0;
      }

      // Fibroblasts: full in intact dermis, reduced in wound
      if (!isEpidermis) {
        fields.fibroblast[idx] = 1.0 - wf * 0.9; // 0.1 surviving in wound
      } else {
        fields.fibroblast[idx] = 0;
      }

      // Collagen: full in intact, absent in wound
      fields.collagen[idx] = 1.0 - wf;

      // Fibrin: absent in intact, fills wound (blood clot)
      fields.fibrin[idx] = wf;

      // Vasculature: full in intact, damaged in wound
      const baseVasc = 1.0 - wf * 0.9; // 0.1 in wound center
      fields.vascularDensity[idx] = baseVasc * scenario.vascularDensityMultiplier;

      // Oxygen: depends on vasculature
      fields.oxygen[idx] = 0.3 + 0.7 * fields.vascularDensity[idx];

      // --- Immune cells ---
      // Initial neutrophil recruitment in wound bed (inflammatory response to injury)
      if (wf > 0.5) {
        fields.neutrophil[idx] = 0.15 * wf;
      }
      fields.apoptoticNeutrophil[idx] = 0;
      fields.macrophageM1[idx] = 0.02 * wf; // small initial presence
      fields.macrophageM2[idx] = 0;

      // --- Cytokines ---
      // Platelet-derived initial burst in wound bed (TGF-β and PDGF)
      fields.tgfBeta[idx] = 0.3 * wf; // platelet degranulation
      fields.pdgf[idx] = 0.4 * wf;    // platelet-derived
      fields.tnfAlpha[idx] = 0.1 * wf; // initial inflammatory signal
      fields.il10[idx] = 0;
      fields.il1[idx] = 0.05 * wf;     // small initial from damaged cells
      fields.kgf[idx] = 0;
      fields.vegf[idx] = 0;

      // --- Bacteria ---
      if (scenario.initialBacterialLoad > 0 && wf > 0.5) {
        fields.bacterialLoad[idx] = scenario.initialBacterialLoad * wf;
      }
      fields.biofilmLoad[idx] = 0;

      // --- Antibiotic ---
      fields.antibioticConc[idx] = 0;
    }
  }
}

/** Deep copy fields (for checkpointing) */
export function cloneFields(fields: SimulationFields): SimulationFields {
  const copy = {} as SimulationFields;
  for (const name of FIELD_NAMES) {
    copy[name] = new Float64Array(fields[name]);
  }
  return copy;
}

/** Serialize fields to a single ArrayBuffer for transfer */
export function fieldsToBuffer(fields: SimulationFields): ArrayBuffer {
  const buffer = new ArrayBuffer(NCELLS * FIELD_NAMES.length * 8);
  const view = new Float64Array(buffer);
  for (let i = 0; i < FIELD_NAMES.length; i++) {
    view.set(fields[FIELD_NAMES[i]], i * NCELLS);
  }
  return buffer;
}

/** Deserialize ArrayBuffer back to fields */
export function bufferToFields(buffer: ArrayBuffer): SimulationFields {
  const view = new Float64Array(buffer);
  const fields = {} as SimulationFields;
  for (let i = 0; i < FIELD_NAMES.length; i++) {
    fields[FIELD_NAMES[i]] = new Float64Array(view.buffer, i * NCELLS * 8, NCELLS);
  }
  return fields;
}

/** Get field value with bounds checking */
export function getField(fields: SimulationFields, name: FieldName, x: number, y: number): number {
  if (x < 0 || x >= NX || y < 0 || y >= NY) return 0;
  return fields[name][y * NX + x];
}
