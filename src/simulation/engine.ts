/**
 * Simulation engine — Strang operator splitting orchestration.
 *
 * Per tick (1 simulated hour):
 *   R(dt/2)  →  Reactions (local ODEs, sub-stepped)
 *   D(dt)    →  Diffusion (ADI, implicit, unconditionally stable)
 *   C(dt)    →  Chemotaxis (upwind, explicit, CFL-subcycled)
 *   R(dt/2)  →  Reactions again
 */

import { NX, NY, NCELLS, SimulationFields, FIELD_NAMES, FieldName, TissueType, SimulationParams, ScenarioConfig } from './types';
import { DEFAULT_PARAMS } from './parameters';
import { allocateFields, createTissueMap, initializeFields } from './fields';
import { applyBoundaryConditions } from './boundary';
import { adiDiffuse } from './solver/adi';
import { applyAllChemotaxis } from './solver/chemotaxis';
import { applyReactions } from './solver/reactions';

/** Fields that undergo diffusion and their parameter keys */
const DIFFUSING_FIELDS: FieldName[] = [
  'oxygen', 'antibioticConc',
  'tnfAlpha', 'tgfBeta', 'il10', 'il1', 'pdgf', 'kgf', 'vegf',
  'neutrophil', 'macrophageM1', 'macrophageM2',
  'fibroblast', 'keratinocyte',
  'vascularDensity', 'bacterialLoad',
];

export interface SimulationState {
  fields: SimulationFields;
  tissueMap: Uint8Array;
  params: SimulationParams;
  scenario: ScenarioConfig;
  tick: number;
  keratMask: Uint8Array; // mask for keratinocyte diffusion (epidermis only)
  bacMask: Uint8Array;   // mask for bacterial diffusion (damaged tissue only)
}

/**
 * Create and initialize a simulation state.
 */
export function createSimulation(
  scenario: ScenarioConfig,
  paramOverrides?: Partial<SimulationParams>,
): SimulationState {
  const params = paramOverrides
    ? { ...DEFAULT_PARAMS, ...paramOverrides }
    : DEFAULT_PARAMS;

  const fields = allocateFields();
  const tissueMap = createTissueMap(params);

  initializeFields(fields, params, scenario);

  // Create keratinocyte mask: only allow diffusion in epidermal layer
  const keratMask = new Uint8Array(NCELLS);
  for (let y = 0; y < NY; y++) {
    for (let x = 0; x < NX; x++) {
      const idx = y * NX + x;
      const t = tissueMap[idx];
      // Keratinocytes can diffuse in epidermis and wound surface
      if (t === TissueType.Epidermis || t === TissueType.WoundSurface) {
        keratMask[idx] = 1;
      }
    }
  }

  const bacMask = new Uint8Array(NCELLS);

  return { fields, tissueMap, params, scenario, tick: 0, keratMask, bacMask };
}

/**
 * Update keratinocyte mask based on current substrate availability.
 * Keratinocytes physically require ECM (fibrin or collagen) to attach and crawl.
 * In wound surface zones, diffusion is blocked where substrate is insufficient.
 * This couples re-epithelialization to granulation tissue formation and prevents
 * keratinocytes from advancing into unsupported wound bed regions (which would
 * cause subsequent anoikis-driven die-off — a non-physical artifact).
 */
function updateKeratMask(
  keratMask: Uint8Array,
  fields: SimulationFields,
  tissueMap: Uint8Array,
): void {
  for (let y = 0; y < NY; y++) {
    for (let x = 0; x < NX; x++) {
      const idx = y * NX + x;
      const t = tissueMap[idx];
      if (t === TissueType.WoundSurface) {
        const fib = fields.fibrin[idx];
        const col = fields.collagen[idx];
        const o2 = fields.oxygen[idx];
        // Also check substrate in wound bed beneath (keratinocytes crawl ON
        // granulation tissue, checking 2 rows down past the epidermal layer)
        const belowY = Math.min(y + 2, NY - 1);
        const belowIdx = belowY * NX + x;
        // Substrate quality: both fibrin (blood clot) and collagen (granulation
        // tissue) support KC migration. Fibrin provides scaffold via integrin
        // α5β1 and fibronectin binding; collagen provides long-term support.
        // Fibrin is weighted 0.7× because it degrades and is less structurally
        // stable than cross-linked collagen. The coupling to granulation
        // tissue formation occurs through O2-dependent migration gating
        // (hypoxic wounds lack O2 for migration) rather than through
        // substrate quality alone.
        const localSub = col + 0.7 * fib;
        const belowSub = fields.collagen[belowIdx] + 0.7 * fields.fibrin[belowIdx];
        const substrate = Math.max(localSub, belowSub);
        // Keratinocyte migration requires adequate oxygen for ATP-intensive
        // processes. Km=0.30 so that at chronic hypoxic O2 (~0.17-0.25),
        // migration is severely impaired even on good substrate. This is
        // the primary mechanism for hypoxic wound closure failure.
        // (O'Toole et al. 1997; Xia et al. 2001)
        const o2MigrationFactor = o2 / (o2 + 0.30);
        const effectiveSubstrate = substrate * o2MigrationFactor;
        keratMask[idx] = effectiveSubstrate > 0.20 ? 1 : 0;
      }
      // Epidermis cells keep mask=1 (set during init), WoundBed/Dermis keep mask=0
    }
  }
}

/**
 * Update bacterial diffusion mask based on tissue damage state.
 * Bacteria can only diffuse through damaged tissue — intact tissue with
 * functional epithelial barriers, intact ECM, and resident immune surveillance
 * is impermeable to bacterial spread. The mask is permissive where tissue
 * shows damage indicators (fibrin presence, collagen loss, vascular damage).
 */
function updateBacMask(
  bacMask: Uint8Array,
  fields: SimulationFields,
  tissueMap: Uint8Array,
): void {
  for (let i = 0; i < NCELLS; i++) {
    const t = tissueMap[i];
    if (t === TissueType.WoundBed || t === TissueType.WoundSurface) {
      // Wound tissue: always permissive
      bacMask[i] = 1;
    } else {
      // Intact tissue: only permissive if significantly damaged
      // (e.g., tissue degradation has spread from wound edge)
      const fib = fields.fibrin[i];
      const col = fields.collagen[i];
      const damage = fib * 0.6 + (1 - col) * 0.4;
      bacMask[i] = damage > 0.25 ? 1 : 0;
    }
  }
}

/**
 * Advance simulation by one tick using Strang splitting.
 */
export function stepSimulation(state: SimulationState): void {
  const { fields, tissueMap, params, scenario, keratMask, bacMask } = state;
  const dt = 1.0; // one tick = one hour

  const vascCap = scenario.vascularDensityMultiplier;

  // R(dt/2) — first half-step of reactions
  applyReactions(
    fields, tissueMap, params, dt * 0.5,
    state.tick, scenario.antibioticStartTick, scenario.antibioticDose, vascCap,
  );

  // Update keratinocyte mask based on current substrate state.
  // This must happen BEFORE the diffusion step so KCs don't diffuse into
  // unsupported wound surface zones.
  updateKeratMask(keratMask, fields, tissueMap);

  // Update bacterial diffusion mask — bacteria cannot spread through intact tissue.
  updateBacMask(bacMask, fields, tissueMap);

  // D(dt) — diffusion (ADI, full step)
  for (const fieldName of DIFFUSING_FIELDS) {
    const D = params.diffusion[fieldName];
    if (D > 0) {
      let mask: Uint8Array | null = null;
      if (fieldName === 'keratinocyte') mask = keratMask;
      else if (fieldName === 'bacterialLoad') mask = bacMask;
      adiDiffuse(fields[fieldName], D, dt, mask);
    }
  }

  // C(dt) — chemotaxis (upwind, full step)
  applyAllChemotaxis(fields, params.chemotaxis, dt, keratMask);

  // R(dt/2) — second half-step of reactions
  applyReactions(
    fields, tissueMap, params, dt * 0.5,
    state.tick, scenario.antibioticStartTick, scenario.antibioticDose, vascCap,
  );

  // Apply boundary conditions
  applyBoundaryConditions(fields);

  // Enforce non-negativity and upper caps.
  // Reactions clamp internally, but diffusion and chemotaxis can push values
  // slightly above physical bounds (e.g. vascularDensity to 1.019 via chemotaxis).
  const CYTOKINE_FIELDS: Set<FieldName> = new Set([
    'tnfAlpha', 'tgfBeta', 'il10', 'il1', 'pdgf', 'kgf', 'vegf', 'antibioticConc',
  ]);
  for (const name of FIELD_NAMES) {
    const f = fields[name];
    const cap = CYTOKINE_FIELDS.has(name) ? 5.0 : 1.0;
    for (let i = 0; i < NCELLS; i++) {
      if (f[i] < 0) f[i] = 0;
      else if (f[i] > cap) f[i] = cap;
    }
  }

  state.tick++;
}
