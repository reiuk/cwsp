// All simulation types and interfaces

/** Grid dimensions */
export const NX = 100;
export const NY = 50;
export const NCELLS = NX * NY;

/** Total simulation ticks (14 days × 24 hours) */
export const TOTAL_TICKS = 336;

/** Names of all state fields stored as Float64Arrays */
export const FIELD_NAMES = [
  'keratinocyte', 'fibroblast', 'collagen', 'fibrin',
  'oxygen', 'vascularDensity',
  'neutrophil', 'apoptoticNeutrophil', 'macrophageM1', 'macrophageM2',
  'tgfBeta', 'tnfAlpha', 'il10', 'il1', 'pdgf', 'kgf', 'vegf',
  'bacterialLoad', 'biofilmLoad',
  'antibioticConc',
] as const;

export type FieldName = typeof FIELD_NAMES[number];
export const NUM_FIELDS = FIELD_NAMES.length;

/** Structure-of-arrays: each field is a contiguous Float64Array */
export type SimulationFields = Record<FieldName, Float64Array>;

/** Tissue type per cell (Uint8Array) */
export const TissueType = {
  Epidermis: 0,
  Dermis: 1,
  WoundBed: 2,
  WoundSurface: 3, // top of wound bed — where keratinocytes migrate
} as const;

/** Diffusion coefficients for each field (non-dimensional) */
export interface DiffusionCoeffs {
  keratinocyte: number;
  fibroblast: number;
  collagen: number;
  fibrin: number;
  oxygen: number;
  vascularDensity: number;
  neutrophil: number;
  apoptoticNeutrophil: number;
  macrophageM1: number;
  macrophageM2: number;
  tgfBeta: number;
  tnfAlpha: number;
  il10: number;
  il1: number;
  pdgf: number;
  kgf: number;
  vegf: number;
  bacterialLoad: number;
  biofilmLoad: number;
  antibioticConc: number;
}

/** Chemotaxis coefficients: [field, chemoattractant] */
export interface ChemotaxisSpec {
  field: FieldName;
  attractant: FieldName;
  chi: number; // chemotactic sensitivity
}

/** Simulation parameters — all non-dimensional */
export interface SimulationParams {
  // --- Diffusion ---
  diffusion: DiffusionCoeffs;

  // --- Chemotaxis ---
  chemotaxis: ChemotaxisSpec[];

  // --- Reaction kinetics ---
  // Neutrophil
  k_nr: number;          // neutrophil recruitment rate
  k_nr_bac: number;      // neutrophil recruitment by bacteria
  k_phag: number;        // phagocytosis rate (neutrophil kills bacteria)
  k_apop: number;        // rate of neutrophil → apoptotic neutrophil

  // Macrophage
  k_m1_recruit: number;  // M1 recruitment rate
  k_m1_decay: number;    // M1 natural decay
  k_switch: number;      // M1 → M2 switch base rate (IL-10 dependent)
  k_efferocytosis: number; // M1 phagocytosis of apoptotic neutrophils
  k_m2_decay: number;    // M2 natural decay
  k_m2_egress: number;   // M2 egress rate as wound matures (collagen-dependent)

  // Cytokines
  k_tnf_n: number;       // TNF-α production by neutrophils
  k_tnf_m1: number;      // TNF-α production by M1 macrophages
  k_tnf_bac: number;     // TNF-α amplification by bacteria (TLR2/TLR9 activation)
  d_tnf: number;         // TNF-α decay rate
  k_tgfb_m2: number;     // TGF-β production by M2 macrophages
  d_tgfb: number;        // TGF-β decay rate
  k_il10_efferocytosis: number; // IL-10 production from efferocytosis
  k_il10_m2: number;     // IL-10 production by M2 macrophages
  d_il10: number;        // IL-10 decay rate
  k_il1_n: number;       // IL-1 production by neutrophils
  k_il1_m1: number;      // IL-1 production by M1 macrophages
  k_il1_bac: number;     // IL-1 amplification by bacteria (TLR activation)
  d_il1: number;         // IL-1 decay rate
  k_pdgf_m2: number;     // PDGF production by macrophages
  d_pdgf: number;        // PDGF decay rate
  k_kgf_fb: number;      // KGF production by fibroblasts (IL-1 dependent)
  d_kgf: number;         // KGF decay rate
  k_vegf_hypoxia: number; // VEGF production under hypoxia
  k_vegf_m2: number;     // VEGF production by M2 macrophages
  d_vegf: number;        // VEGF decay rate

  // Half-saturation constants (Michaelis-Menten)
  K_tgfb: number;        // TGF-β half-saturation
  K_tnf: number;         // TNF-α half-saturation
  K_il10: number;        // IL-10 half-saturation
  K_il1: number;         // IL-1 half-saturation
  K_pdgf: number;        // PDGF half-saturation
  K_kgf: number;         // KGF half-saturation
  K_vegf: number;        // VEGF half-saturation
  K_oxygen: number;      // Oxygen half-saturation

  // Fibroblast
  k_fp: number;          // fibroblast proliferation rate
  k_fb_apoptosis: number; // fibroblast apoptosis rate

  // Collagen / Fibrin
  k_cp: number;          // collagen production rate
  k_fd: number;          // fibrin degradation rate

  // Keratinocyte
  k_kp: number;          // keratinocyte proliferation rate

  // Oxygen
  k_o2_source: number;   // O2 delivery from vasculature
  k_o2_cell: number;     // O2 consumption by cells
  k_o2_bac: number;      // O2 consumption by bacteria

  // Angiogenesis
  k_angio: number;       // vascular growth rate (VEGF dependent)
  k_vasc_decay: number;  // vascular density decay in wound

  // Bacteria
  mu_max: number;        // max growth rate
  k_biofilm_transition: number; // rate of planktonic → biofilm transition
  biofilm_threshold: number;    // density threshold for biofilm formation
  biofilm_resistance: number;   // resistance factor (100x)
  k_bac_impair: number;  // bacterial impairment of keratinocyte migration
  k_bac_ecm: number;     // bacterial ECM degradation rate
  k_bac_inflam: number;  // bacterial sustaining of inflammation

  // Antibiotic
  k_abx_kill: number;    // antibiotic killing rate
  mic_threshold: number; // minimum inhibitory concentration
  k_abx_decay: number;   // antibiotic clearance rate

  // Wound geometry
  woundLeft: number;
  woundRight: number;
  woundDepth: number;
  epidermisRows: number;
}

/** Scenario configuration */
export interface ScenarioConfig {
  name: string;
  description: string;
  initialBacterialLoad: number;
  vascularDensityMultiplier: number;
  antibioticStartTick: number | null; // null = no antibiotic
  antibioticDose: number;
}

/** Aggregate metrics computed each tick */
export interface TickMetrics {
  tick: number;
  woundClosurePct: number;
  avgBacterialLoad: number;
  avgCollagen: number;
  avgNeutrophil: number;
  avgMacrophageM1: number;
  avgMacrophageM2: number;
  avgTnfAlpha: number;
  avgIl10: number;
  avgOxygen: number;
  avgVascularDensity: number;
  inflammatoryRatio: number; // TNF-α / (IL-10 + epsilon)
}

/** Messages from main thread to worker */
export type WorkerInMessage =
  | { type: 'init'; scenario: ScenarioConfig; params?: Partial<SimulationParams> }
  | { type: 'run'; speed: number } // ticks per batch
  | { type: 'pause' }
  | { type: 'step' } // single tick
  | { type: 'seek'; tick: number }
  | { type: 'setOverlay'; overlay: OverlayMode };

/** Messages from worker to main thread */
export type WorkerOutMessage =
  | { type: 'tick'; tick: number; metrics: TickMetrics; buffer: ArrayBuffer }
  | { type: 'checkpoint'; tick: number }
  | { type: 'done' }
  | { type: 'error'; message: string };

export type OverlayMode = 'tissue' | 'oxygen' | 'bacterial' | 'inflammatory' | 'collagen';
