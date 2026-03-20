/**
 * Published parameter values, non-dimensionalized.
 *
 * Non-dimensionalization scheme (extending Menon, Flegg et al. 2012):
 *   Length scale: L₀ = 0.01 cm = 0.1 mm (one grid cell)
 *   Time scale:  T₀ = 3600 s = 1 hour (one tick)
 *   Cell densities: normalized by carrying capacity → [0, 1]
 *   Cytokines: normalized by EC₅₀ values → 1.0 = half-max effect
 *
 * All diffusion coefficients D are non-dimensionalized as D* = D × T₀ / L₀²
 * Example: D_O2 = 2e-5 cm²/s → D* = 2e-5 × 3600 / (0.01)² = 720
 *   This is huge, which is why we need implicit (ADI) diffusion.
 */

import { SimulationParams, ChemotaxisSpec, ScenarioConfig } from './types';

// --- Non-dimensionalization constants ---
const L0 = 0.01;    // cm (grid spacing)
const T0 = 3600;    // seconds (1 hour)
const L0sq = L0 * L0;

/** Convert dimensional diffusion coefficient (cm²/s) to non-dimensional */
function ndDiffusion(D_cm2_s: number): number {
  return D_cm2_s * T0 / L0sq;
}

/**
 * Non-dimensional diffusion coefficients.
 * Sources:
 *   O2: 2e-5 cm²/s (standard tissue value)
 *   Cytokines (small proteins): ~1e-7 cm²/s (typical for 10-30 kDa proteins in tissue)
 *   Cells: ~1e-9 to 1e-8 cm²/s (much slower, random motility)
 *   Antibiotics: ~5e-6 cm²/s (small molecules)
 */
const diffusionCoeffs = {
  oxygen:            ndDiffusion(2e-7),     // 7.2 — strongly reduced: O2 delivery is perfusion-limited, not diffusion-limited
  antibioticConc:    ndDiffusion(5e-6),     // 180
  tnfAlpha:          ndDiffusion(1e-7),     // 3.6
  tgfBeta:           ndDiffusion(1e-7),     // 3.6
  il10:              ndDiffusion(1e-7),     // 3.6
  il1:               ndDiffusion(1e-7),     // 3.6
  pdgf:              ndDiffusion(1e-7),     // 3.6
  kgf:               ndDiffusion(1e-7),     // 3.6
  vegf:              ndDiffusion(1e-7),     // 3.6
  neutrophil:        ndDiffusion(5e-9),     // 0.18
  apoptoticNeutrophil: ndDiffusion(1e-10),  // ~0 (dead cells don't move much)
  macrophageM1:      ndDiffusion(3e-9),     // 0.108
  macrophageM2:      ndDiffusion(3e-9),     // 0.108
  fibroblast:        ndDiffusion(1e-9),     // 0.036 — Menon/Flegg 2012 gives 1.7e-10 cm²/s (D*=0.006) for 1D;
                                            // elevated ~6× for 2D cross-section where fibroblast dispersal from
                                            // wound margins into the wound center must occur on the correct timescale.
                                            // At the published value, fibroblasts remain too concentrated at margins
                                            // and the hypoxic wound incorrectly reaches 58% closure instead of stalling.
  keratinocyte:      ndDiffusion(5e-9),     // 0.18 — Menon et al. 2012 use 4.33e-9; slightly higher for 2D surface migration
  collagen:          0,                      // ECM doesn't diffuse
  fibrin:            0,                      // ECM doesn't diffuse
  vascularDensity:   ndDiffusion(5e-10),    // very slow spread (vessel sprouting, handled more by reaction)
  bacterialLoad:     ndDiffusion(1e-9),     // slow bacterial motility
  biofilmLoad:       0,                      // biofilm is sessile
};

/** Chemotaxis specifications */
const chemotaxisSpecs: ChemotaxisSpec[] = [
  // Fibroblasts migrate toward PDGF gradient (Menon et al. 2012)
  { field: 'fibroblast', attractant: 'pdgf', chi: 0.5 },
  // Neutrophils migrate toward TNF-α (chemotaxis to inflammation site)
  { field: 'neutrophil', attractant: 'tnfAlpha', chi: 0.8 },
  // M1 macrophages migrate toward TNF-α
  { field: 'macrophageM1', attractant: 'tnfAlpha', chi: 0.4 },
  // Endothelial sprouting toward VEGF
  { field: 'vascularDensity', attractant: 'vegf', chi: 0.15 },
];

/**
 * Default simulation parameters.
 * Rate constants are per-tick (per hour) in non-dimensional units.
 */
export const DEFAULT_PARAMS: SimulationParams = {
  diffusion: diffusionCoeffs,
  chemotaxis: chemotaxisSpecs,

  // --- Neutrophil kinetics (Nagaraja et al. 2017) ---
  k_nr: 0.12,           // neutrophil recruitment (fibrin DAMP + TNF-α + bacteria)
  k_nr_bac: 0.15,       // direct recruitment by bacteria
  k_phag: 0.5,          // phagocytosis rate (increased to compensate for O2 dependence)
  k_apop: 0.08,         // rate neutrophils become apoptotic → ~8.5hr half-life in tissue
                        // (tissue neutrophils die faster than in vitro due to inflammatory environment)

  // --- Macrophage kinetics (Nagaraja et al. 2017) ---
  k_m1_recruit: 0.035,  // M1 recruitment — calibrated to peak at day 2-4 (monocyte
                        // extravasation lags behind neutrophils in vivo; Wilgus et al. 2013)
  k_m1_decay: 0.02,     // M1 natural decay
  k_switch: 0.08,       // M1→M2 switch (IL-10 dependent + efferocytosis)
  k_efferocytosis: 0.25, // M1 clearance of apoptotic neutrophils
  k_m2_decay: 0.012,    // M2 decay (~58hr half-life; macrophages emigrate from healing wounds)
  k_m2_egress: 0.015,   // M2 egress as wound matures: macrophages leave as collagen accumulates

  // --- Cytokine kinetics ---
  // TNF-α (half-life ~1-2 hr → decay ~0.35-0.7/hr)
  k_tnf_n: 0.1,
  k_tnf_m1: 0.15,
  k_tnf_bac: 0.2,       // bacteria activate TLR2/TLR9 on immune cells → amplified TNF-α release
  d_tnf: 0.5,           // decay rate → ~1.4 hr half-life

  // TGF-β (Menon et al. 2012)
  // Platelet-derived TGF-β is modelled via initial conditions (tgfBeta=0.3 in wound bed),
  // not as a dynamic degranulation term, because the burst completes within minutes
  // and the 1-hour timestep cannot resolve sub-hour platelet kinetics.
  k_tgfb_m2: 0.12,     // increased to compensate for new O2 dependence: at normal O2 (mm_o2≈0.70), effective rate ≈ 0.084
  d_tgfb: 0.1,          // slower decay than TNF-α

  // IL-10
  k_il10_efferocytosis: 0.15,
  k_il10_m2: 0.08,      // M2 positive feedback
  d_il10: 0.3,

  // IL-1
  k_il1_n: 0.08,
  k_il1_m1: 0.1,
  k_il1_bac: 0.15,      // bacteria activate immune cells → amplified IL-1β release (TLR signaling)
  d_il1: 0.4,

  // PDGF (platelet-derived PDGF modelled via initial conditions: pdgf=0.4 in wound bed)
  k_pdgf_m2: 0.05,
  d_pdgf: 0.15,

  // KGF
  k_kgf_fb: 0.12,       // fibroblasts produce KGF (baseline + IL-1 stimulated)
  d_kgf: 0.15,

  // VEGF
  k_vegf_hypoxia: 0.12, // production in hypoxic cells
  k_vegf_m2: 0.06,
  d_vegf: 0.2,

  // --- Half-saturation constants (Michaelis-Menten) ---
  // Set so typical wound concentrations produce 30-70% saturation.
  // Cytokine steady-states are ~0.02-0.1 in this normalization.
  K_tgfb: 0.05,         // TGF-β ss ~0.03-0.08 → 40-60% saturation
  K_tnf: 0.05,          // TNF-α ss ~0.02-0.07 → 30-60% saturation
  K_il10: 0.02,         // IL-10 ss ~0.01-0.03 → 30-60% saturation
  K_il1: 0.03,          // IL-1 ss ~0.01-0.04 → 25-55% saturation
  K_pdgf: 0.08,         // PDGF ss ~0.05-0.1 → 40-55% saturation
  K_kgf: 0.08,          // KGF ss ~0.05-0.12 → 40-60% saturation
  K_vegf: 0.05,         // VEGF ss ~0.03-0.08 → 40-60% saturation
  K_oxygen: 0.35,       // O2 levels: at 0.7 → mm=0.67 (normal), at 0.2 → mm=0.36 (hypoxic, ~50% reduction per Menon et al. 2012)

  // --- Fibroblast kinetics (Menon et al. 2012) ---
  k_fp: 0.035,          // proliferation rate → ~20hr doubling time at max stimulation
  k_fb_apoptosis: 0.005,

  // --- ECM (Menon et al. 2012) ---
  k_cp: 0.025,          // collagen production
  k_fd: 0.05,           // fibrin degradation by fibroblasts

  // --- Keratinocyte (Menon et al. 2012) ---
  // Migration speed 30-60 μm/hr → at 100μm grid spacing, ~0.3-0.6 cells/hr
  // Handled primarily through diffusion coefficient
  k_kp: 0.08,           // proliferation rate — calibrated to ~100% closure by day 12-14 (Singer & Clark 1999)

  // --- Oxygen ---
  k_o2_source: 0.4,     // O2 delivery from vasculature
  k_o2_cell: 0.15,      // O2 consumption by cells (higher to create gradients)
  k_o2_bac: 0.2,        // O2 consumption by bacteria

  // --- Angiogenesis ---
  k_angio: 0.015,       // vessel growth rate (VEGF dependent)
  k_vasc_decay: 0.002,  // slow background vascular regression in wound

  // --- Bacteria ---
  mu_max: 0.5,          // ~83 min doubling in wound conditions: ln(2)/0.5 ≈ 1.39hr ≈ 83 min
  k_biofilm_transition: 0.02,
  biofilm_threshold: 0.3,
  biofilm_resistance: 100,
  k_bac_impair: 0.8,    // bacterial impairment of keratinocyte migration: at bac=0.75,
                        // gives 40% residual activity (~60% reduction), matching Maddocks
                        // et al. 2020 (61% reduction via connexin-43 upregulation)
  k_bac_ecm: 0.08,      // bacterial ECM degradation
  k_bac_inflam: 4.0,    // bacterial sustaining of inflammation: at bac=0.5, suppresses M1→M2 by ~67%

  // --- Antibiotic ---
  k_abx_kill: 0.8,
  mic_threshold: 0.1,
  k_abx_decay: 0.1,     // ~7hr half-life

  // --- Wound geometry ---
  // 70 cells wide (7mm) gives re-epithelialization in ~10-14 days at published
  // keratinocyte migration speeds of 30-60 μm/hr (Menon et al. 2012).
  // 4mm wound was too small — closed in 3-4 days, inconsistent with the
  // 10-14 day timecourse from the validation targets.
  woundLeft: 15,
  woundRight: 85,
  woundDepth: 25,
  epidermisRows: 2,
};

/** Scenario presets */
export const SCENARIOS: Record<string, ScenarioConfig> = {
  normal: {
    name: 'Normal Acute Wound',
    description: 'Uninfected excisional wound healing by secondary intention',
    initialBacterialLoad: 0,
    vascularDensityMultiplier: 1.0,
    antibioticStartTick: null,
    antibioticDose: 0,
  },
  infected: {
    name: 'S. aureus Infection',
    description: 'Acute wound contaminated with S. aureus at time of injury',
    initialBacterialLoad: 0.15,
    vascularDensityMultiplier: 1.0,
    antibioticStartTick: null,
    antibioticDose: 0,
  },
  earlyAbx: {
    name: 'Early Antibiotic (6hr)',
    description: 'S. aureus infection treated with antibiotic at hour 6',
    initialBacterialLoad: 0.15,
    vascularDensityMultiplier: 1.0,
    antibioticStartTick: 6,
    antibioticDose: 0.8,
  },
  lateAbx: {
    name: 'Delayed Antibiotic (48hr)',
    description: 'S. aureus infection treated with antibiotic at hour 48',
    initialBacterialLoad: 0.15,
    vascularDensityMultiplier: 1.0,
    antibioticStartTick: 48,
    antibioticDose: 0.8,
  },
  hypoxic: {
    name: 'Chronic Hypoxic Wound',
    description: 'Wound with severely reduced vasculature (8% of normal) — models chronic hypoxia from PVD/diabetes per Menon et al. 2012 (Figure 4: failed re-epithelialization)',
    initialBacterialLoad: 0,
    vascularDensityMultiplier: 0.08,
    antibioticStartTick: null,
    antibioticDose: 0,
  },
};
