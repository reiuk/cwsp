/**
 * Aggregate metric computation.
 */

import { NX, NY, SimulationFields, TissueType, TickMetrics, SimulationParams } from './types';

/**
 * Compute aggregate metrics for the current simulation state.
 * Wound closure is measured as fraction of wound surface covered by keratinocytes.
 */
export function computeMetrics(
  fields: SimulationFields,
  tissueMap: Uint8Array,
  tick: number,
  params: SimulationParams,
): TickMetrics {
  const { woundLeft, woundRight, epidermisRows } = params;

  // Wound closure: average keratinocyte density along wound surface (top rows)
  let kcSum = 0;
  let kcCount = 0;
  for (let y = 0; y < epidermisRows; y++) {
    for (let x = woundLeft; x < woundRight; x++) {
      const idx = y * NX + x;
      kcSum += fields.keratinocyte[idx];
      kcCount++;
    }
  }
  const woundClosurePct = kcCount > 0 ? (kcSum / kcCount) * 100 : 0;

  // Average metrics in wound bed
  let bacSum = 0, colSum = 0, neutSum = 0, m1Sum = 0, m2Sum = 0;
  let tnfSum = 0, il10Sum = 0, o2Sum = 0, vascSum = 0;
  let woundCount = 0;

  for (let y = 0; y < NY; y++) {
    for (let x = woundLeft; x < woundRight; x++) {
      const idx = y * NX + x;
      const t = tissueMap[idx];
      if (t === TissueType.WoundBed || t === TissueType.WoundSurface) {
        bacSum += fields.bacterialLoad[idx] + fields.biofilmLoad[idx];
        colSum += fields.collagen[idx];
        neutSum += fields.neutrophil[idx];
        m1Sum += fields.macrophageM1[idx];
        m2Sum += fields.macrophageM2[idx];
        tnfSum += fields.tnfAlpha[idx];
        il10Sum += fields.il10[idx];
        o2Sum += fields.oxygen[idx];
        vascSum += fields.vascularDensity[idx];
        woundCount++;
      }
    }
  }

  const n = Math.max(woundCount, 1);
  const avgTnf = tnfSum / n;
  const avgIl10 = il10Sum / n;

  return {
    tick,
    woundClosurePct,
    avgBacterialLoad: bacSum / n,
    avgCollagen: colSum / n,
    avgNeutrophil: neutSum / n,
    avgMacrophageM1: m1Sum / n,
    avgMacrophageM2: m2Sum / n,
    avgTnfAlpha: avgTnf,
    avgIl10: avgIl10,
    avgOxygen: o2Sum / n,
    avgVascularDensity: vascSum / n,
    inflammatoryRatio: avgTnf / (avgIl10 + 0.01),
  };
}
