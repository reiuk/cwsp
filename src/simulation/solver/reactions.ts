/**
 * Local ODE reaction system — all coupled wound biology.
 *
 * Runs at every cell, every tick. No phase gating.
 * All growth-factor-dependent terms use Michaelis-Menten saturating kinetics.
 *
 * Sub-stepped with 4 internal steps per half-tick for stiff reaction terms.
 */

import { NX, NY, NCELLS, TissueType } from '../types';
import type { SimulationFields, SimulationParams } from '../types';

/** Michaelis-Menten saturation function */
function mm(s: number, K: number): number {
  return s / (s + K);
}

/** Clamp value to [0, cap] */
function clamp(v: number, cap: number = 1.0): number {
  return v < 0 ? 0 : v > cap ? cap : v;
}

/**
 * Apply all reaction terms for dt/2 (half-step in Strang splitting).
 * Sub-stepped internally for stability.
 */
export function applyReactions(
  fields: SimulationFields,
  tissueMap: Uint8Array,
  params: SimulationParams,
  dt: number,
  currentTick: number,
  antibioticStartTick: number | null,
  antibioticDose: number,
  vascularCap: number = 1.0,
): void {
  const p = params;
  const nSub = 4; // sub-steps per half-step
  const subDt = dt / nSub;

  for (let sub = 0; sub < nSub; sub++) {
    for (let i = 0; i < NCELLS; i++) {
      const tissue = tissueMap[i];

      // Extract local state
      let kc = fields.keratinocyte[i];
      let fb = fields.fibroblast[i];
      let col = fields.collagen[i];
      let fib = fields.fibrin[i];
      let o2 = fields.oxygen[i];
      let vasc = fields.vascularDensity[i];
      let neut = fields.neutrophil[i];
      let neutApop = fields.apoptoticNeutrophil[i];
      let m1 = fields.macrophageM1[i];
      let m2 = fields.macrophageM2[i];
      let tgf = fields.tgfBeta[i];
      let tnf = fields.tnfAlpha[i];
      let il10 = fields.il10[i];
      let il1 = fields.il1[i];
      let pdgf = fields.pdgf[i];
      let kgf = fields.kgf[i];
      let vegf = fields.vegf[i];
      let bac = fields.bacterialLoad[i];
      let bio = fields.biofilmLoad[i];
      let abx = fields.antibioticConc[i];

      // Saturating kinetics
      const mm_tgf = mm(tgf, p.K_tgfb);
      const mm_tnf = mm(tnf, p.K_tnf);
      const mm_il10 = mm(il10, p.K_il10);
      const mm_il1 = mm(il1, p.K_il1);
      const mm_kgf = mm(kgf, p.K_kgf);
      const mm_vegf = mm(vegf, p.K_vegf);
      const mm_o2 = mm(o2, p.K_oxygen);

      // Wound maturity factor: as collagen replaces provisional matrix,
      // the tissue transitions from an inflammatory to a remodeling
      // microenvironment. Mature ECM downregulates endothelial adhesion
      // molecules (ICAM-1, VCAM-1) and reduces chemokine gradients,
      // suppressing further immune cell infiltration (Wilgus et al. 2013).
      // Quadratic Hill form with k=8: at col=0.5: 0.33; col=0.75: 0.18;
      // col=1.0: 0.11. The k=8 coefficient limits the late M1 rebound
      // (from IL-10 withdrawal as M2 emigrate) to <1.5× at absolute levels
      // below 20% of peak — consistent with low-grade remodeling inflammation.
      const woundMaturity = 1 / (1 + 8 * col * col);

      // === NEUTROPHILS ===
      // Recruited via vasculature, driven by:
      //   - Fibrin (DAMP signal from clot — transient, decays as fibrin is degraded)
      //   - TNF-α (inflammatory signal — weaker to prevent runaway)
      //   - Bacteria (direct chemotactic signal)
      // IL-10 actively suppresses neutrophil recruitment (pro-resolving mechanism,
      // Nagaraja et al. 2017; this ensures neutrophil resolution when inflammation resolves)
      // Fibrin acts as a DAMP (damage-associated molecular pattern) signal for
      // immune recruitment via TLR4/RAGE activation. Signal uses Hill kinetics (n=2)
      // so it drops off steeply as fibrin is cleared — low residual fibrin levels
      // (<0.2) produce negligible recruitment, ensuring proper neutrophil resolution.
      const fib2 = fib * fib;
      const K_damp = 0.25;
      const dampSignal = fib2 / (fib2 + K_damp * K_damp);
      // IL-10 actively suppresses neutrophil recruitment (Nagaraja et al. 2017).
      // Coefficient 12 gives ~70% suppression at typical healing IL-10 levels (~0.18),
      // ensuring proper neutrophil resolution by day 5-7.
      const il10Suppress = 1 / (1 + 12 * il10);
      // Neutrophil recruitment: DAMP (fibrin) is the primary chemoattractant for
      // initial recruitment. TNF-α provides weaker secondary signal via endothelial
      // activation. As fibrin clears, recruitment drops sharply, producing the
      // characteristic transient neutrophil peak at day 1-2 followed by resolution.
      const neutRecruit = (p.k_nr * (dampSignal + mm_tnf * 0.15) + p.k_nr_bac * bac) * vasc * il10Suppress * woundMaturity;
      // Apoptosis → apoptotic neutrophil compartment
      const neutApoptosis = p.k_apop * neut;
      // Neutrophil bactericidal activity — O2-dependent because intracellular
      // killing relies on respiratory burst (NADPH oxidase → superoxide → HOCl).
      // Phagocytosis (engulfment) itself is O₂-independent, but the killing
      // step requires O₂. CGD patients lacking NADPH oxidase have severe
      // susceptibility to S. aureus. In the wound context, this creates a
      // spatial gradient: effective killing at well-perfused margins, impaired
      // at hypoxic center. k_phag represents the combined phagocytosis + kill rate.
      const phagocytosis = p.k_phag * neut * bac * mm_o2;

      const dNeut = (neutRecruit - neutApoptosis) * subDt;
      neut = clamp(neut + dNeut);

      // === APOPTOTIC NEUTROPHILS ===
      // Efferocytosis by both M1 AND M2 macrophages. M2 macrophages are
      // the primary efferocytic cells (Fadok et al. 1998, J Clin Invest;
      // Savill et al. 1989, J Clin Invest). M2 are ~2x more efficient
      // due to upregulated MerTK, CD36, and phosphatidylserine receptors.
      // Baseline clearance by tissue-resident macrophages and DCs prevents
      // unphysical accumulation of dead neutrophils beyond the model's
      // explicit macrophage population.
      const efferocytosis = p.k_efferocytosis * (m1 + 2 * m2) * neutApop;
      const baselineClearance = 0.05 * neutApop;
      const dNeutApop = (neutApoptosis - efferocytosis - baselineClearance) * subDt;
      neutApop = clamp(neutApop + dNeutApop);

      // === MACROPHAGES M1 ===
      // Monocyte recruitment is primarily chemokine-driven (CCL2/MCP-1), modeled
      // here as TNF-α dependent since TNF-α upregulates endothelial adhesion
      // molecules and correlates with monocyte influx timing. DAMP signal is
      // secondary. This weighting delays M1 peak to day 3-4, matching published
      // monocyte kinetics (Wilgus et al. 2013, Novak & Koh 2013).
      const m1Recruit = p.k_m1_recruit * (mm_tnf * 0.85 + dampSignal * 0.15) * vasc * il10Suppress * woundMaturity;
      // M1 → M2 switch driven primarily by IL-10 with efferocytosis
      // as a secondary contributor. The IL-10 pathway is the dominant
      // mechanism (Gordon & Martinez 2010); efferocytosis contributes
      // by triggering IL-10 release (handled in IL-10 production term)
      // and by direct reprogramming (weaker effect, coefficient 0.3).
      const m1ToM2Base = p.k_switch * mm_il10 * m1 + 0.3 * efferocytosis;
      // Bacteria sustain M1 state (suppress switching)
      const bacSuppressSwitch = 1 / (1 + p.k_bac_inflam * bac);
      const effectiveM1ToM2 = m1ToM2Base * bacSuppressSwitch;
      const m1Decay = p.k_m1_decay * m1;

      const dM1 = (m1Recruit - effectiveM1ToM2 - m1Decay) * subDt;
      m1 = clamp(m1 + dM1);

      // === MACROPHAGES M2 ===
      // M2 macrophages emigrate from the wound as it matures (collagen accumulates).
      // This produces the observed peak-and-decline pattern during remodeling.
      const m2Decay = p.k_m2_decay * m2 + p.k_m2_egress * col * m2;
      const dM2 = (effectiveM1ToM2 - m2Decay) * subDt;
      m2 = clamp(m2 + dM2);

      // === Bacterial impairment of M2 function ===
      // S. aureus (esp. biofilm) disrupts M2 macrophage polarisation and function:
      // reduced NADPH oxidase, lower ROS, impaired cytokine output (Hanke et al.
      // 2013, Wound Repair Regen; Thurlow et al. 2011, J Immunol). This is a key
      // mechanism by which infection prevents the healing switch.
      const bacM2Impair = 1 / (1 + 2 * (bac + bio));

      // === TNF-α ===
      // Bacteria activate TLR2/TLR9 on neutrophils and macrophages, amplifying
      // TNF-α release. This is the key mechanism by which infection sustains
      // pro-inflammatory signaling (Fournier & Bhatt, 2012 etc.)
      const tnfProd = p.k_tnf_n * neut + p.k_tnf_m1 * m1 + p.k_tnf_bac * bac * (neut + m1);
      const tnfDecay = p.d_tnf * tnf;
      tnf = clamp(tnf + (tnfProd - tnfDecay) * subDt, 5.0);

      // === TGF-β ===
      // TGF-β production is oxygen-dependent: Menon et al. 2012 (via Siddiqui et al.)
      // show 3.1-fold reduction under chronic hypoxia. At mm_o2=0.46 (our hypoxic
      // wound), this gives ~2.2x reduction; combined with fewer M2 macrophages,
      // total TGF-β is substantially reduced. Also impaired by bacterial infection.
      const tgfProd = p.k_tgfb_m2 * m2 * mm_o2 * bacM2Impair;
      const tgfDecay = p.d_tgfb * tgf;
      tgf = clamp(tgf + (tgfProd - tgfDecay) * subDt, 5.0);

      // === IL-10 ===
      // M2-derived IL-10 is also impaired by bacteria (same M2 dysfunction mechanism).
      const il10Prod = p.k_il10_efferocytosis * efferocytosis + p.k_il10_m2 * m2 * bacM2Impair;
      const il10Decay = p.d_il10 * il10;
      il10 = clamp(il10 + (il10Prod - il10Decay) * subDt, 5.0);

      // === IL-1 ===
      // Bacteria also amplify IL-1β release via TLR/inflammasome activation.
      const il1Prod = p.k_il1_n * neut + p.k_il1_m1 * m1 + p.k_il1_bac * bac * (neut + m1);
      const il1Decay = p.d_il1 * il1;
      il1 = clamp(il1 + (il1Prod - il1Decay) * subDt, 5.0);

      // === PDGF ===
      const pdgfProd = p.k_pdgf_m2 * m2;
      const pdgfDecay = p.d_pdgf * pdgf;
      pdgf = clamp(pdgf + (pdgfProd - pdgfDecay) * subDt, 5.0);

      // === KGF ===
      // Produced by fibroblasts, stimulated by IL-1
      // Also has a baseline production from intact dermal fibroblasts
      const kgfProd = p.k_kgf_fb * fb * (0.3 + 0.7 * mm_il1);
      const kgfDecay = p.d_kgf * kgf;
      kgf = clamp(kgf + (kgfProd - kgfDecay) * subDt, 5.0);

      // === VEGF ===
      const hypoxiaSignal = 1 - mm_o2; // high when O2 is low
      const vegfProd = p.k_vegf_hypoxia * hypoxiaSignal * (fb + m2 * 0.5) + p.k_vegf_m2 * m2 * bacM2Impair;
      const vegfDecay = p.d_vegf * vegf;
      vegf = clamp(vegf + (vegfProd - vegfDecay) * subDt, 5.0);

      // === FIBROBLASTS ===
      if (tissue !== TissueType.Epidermis) {
        // Menon et al. 2012 form: s_f * f * (1-f) * (1 + a_f * T/(1+T))
        // Baseline proliferation (TGF-β independent) + TGF-β enhancement
        const fbTgfBoost = 0.3 + 0.7 * mm_tgf; // 30% baseline, up to 100% with TGF-β
        const fbProlif = p.k_fp * fb * (1 - fb) * fbTgfBoost * mm_o2;
        const fbDeath = p.k_fb_apoptosis * fb;
        fb = clamp(fb + (fbProlif - fbDeath) * subDt);
      }

      // === COLLAGEN ===
      if (tissue !== TissueType.Epidermis) {
        const colProd = p.k_cp * fb * mm_tgf * mm_o2 * (1 - col);
        const colDeg = p.k_bac_ecm * bac * col;
        col = clamp(col + (colProd - colDeg) * subDt);
      }

      // === FIBRIN ===
      if (tissue !== TissueType.Epidermis) {
        // Degraded by fibroblasts + baseline plasmin activity + immune cells
        const fibDegFb = p.k_fd * fb * fib;
        // Fibrin provisional matrix persists 3-5 days in vivo (Clark 1996, "The
        // Molecular and Cellular Biology of Wound Repair"). Plasmin-mediated
        // degradation is slow early and accelerates as fibroblasts upregulate uPA.
        // Fibrin clot persists 3-5 days in vivo (Clark 1996). Combined baseline
        // + immune degradation at typical early wound levels (neut≈0.25, m1≈0.1)
        // gives total rate ~0.003+0.0014=0.0044/hr → half-life ~160hr ≈ 6.5 days.
        // With fibroblast degradation (k_fd=0.05): as fb invades, fibrin clears
        // within 3-5 days — matching published kinetics.
        const fibDegBaseline = 0.002 * fib;
        const fibDegImmune = 0.004 * (neut + m1) * fib;
        fib = clamp(fib + (-(fibDegFb + fibDegBaseline + fibDegImmune)) * subDt);
      }

      // === KERATINOCYTES ===
      // Only on wound surface (top 2 rows)
      if (tissue === TissueType.WoundSurface || tissue === TissueType.Epidermis) {
        // Keratinocytes require ECM substrate (fibrin clot or collagen) to migrate on.
        // They migrate on TOP of the granulation tissue bed, so substrate includes
        // the wound bed immediately below (2 rows down past the epidermal layer).
        // This couples re-epithelialization to granulation tissue formation,
        // which is why hypoxic wounds (no fibroblast activity → no collagen) fail to close.
        const y_coord = Math.floor(i / NX);
        const x_coord = i % NX;
        // Substrate: both collagen and fibrin support KC adhesion/proliferation.
        // Same weighting as keratMask for consistency.
        let substrate = col + 0.7 * fib;
        if (tissue === TissueType.WoundSurface) {
          const belowY = Math.min(y_coord + 2, NY - 1);
          const belowIdx = belowY * NX + x_coord;
          const belowSub = fields.collagen[belowIdx] + 0.7 * fields.fibrin[belowIdx];
          substrate = Math.max(substrate, belowSub);
        }
        // Hill function (n=3) for sharp threshold: keratinocytes are fine above ~0.3
        // substrate but rapidly lose viability below that.
        const s3 = substrate * substrate * substrate;
        const K_sub = 0.15;
        const K_sub3 = K_sub * K_sub * K_sub;
        const substrateFactor = s3 / (s3 + K_sub3);

        const kcBaseProlif = 0.3; // baseline proliferation (KGF-independent)
        const kcKgfBoost = 0.7 * mm_kgf; // KGF enhancement
        const totalBac = clamp(bac + bio);
        const bacImpair = Math.max(0, 1 - p.k_bac_impair * totalBac);
        const kcProlif = p.k_kp * kc * (1 - kc) * (kcBaseProlif + kcKgfBoost) * mm_o2 * bacImpair * substrateFactor;
        // Bacterial toxicity: S. aureus exotoxins (alpha-hemolysin, PSMs)
        // damage keratinocytes but at clinically observed levels do not
        // cause margin regression (Schierle et al. 2009; Pastar et al.
        // 2013 show stalling, not regression). Rate 0.003/hr at bac=0.75
        // → ~310hr half-life — slow enough for stable margins.
        const bacToxicity = 0.004 * totalBac * kc;
        // Without substrate, keratinocytes detach (anoikis — programmed death
        // from loss of ECM anchorage). However, established keratinocytes
        // produce their own basement membrane proteins (laminin-5, collagen IV)
        // and are more resistant to anoikis than freshly seeded cells.
        // Rate 0.005/hr → ~140hr half-life — slow enough that established
        // keratinocytes persist while substrate rebuilds, preventing the
        // non-physical advance-retreat pattern seen with faster anoikis.
        // Migration restriction to supported areas is handled by the
        // keratMask in the diffusion solver, which is the primary mechanism.
        const anoikis = tissue === TissueType.WoundSurface ? 0.005 * kc * (1 - substrateFactor) : 0;
        kc = clamp(kc + (kcProlif - bacToxicity - anoikis) * subDt);
      }

      // === OXYGEN ===
      // Consumption follows Michaelis-Menten kinetics: cells can't consume
      // more O2 than is available. This prevents O2 from going negative and
      // creates proper O2 steady states at all vascular densities.
      const o2Source = p.k_o2_source * vasc * (1 - o2);
      const o2Consume = (p.k_o2_cell * (fb + kc) + p.k_o2_bac * (bac + bio)) * mm_o2;
      o2 = clamp(o2 + (o2Source - o2Consume) * subDt);

      // === ANGIOGENESIS ===
      if (tissue === TissueType.WoundBed || tissue === TissueType.WoundSurface) {
        // Vessel growth driven by VEGF, capped by systemic capacity.
        // Weak O2 dependence: endothelial cells need minimal O2 for sprouting
        // but severe hypoxia (O2 < 0.05) still impairs function.
        // Using a low Km = 0.05 so only extreme hypoxia suppresses angiogenesis.
        const angioO2 = o2 / (o2 + 0.05);
        const vascGrowth = p.k_angio * mm_vegf * Math.max(0, vascularCap - vasc) * angioO2;
        const vascDecay = p.k_vasc_decay * (1 - col) * vasc;
        vasc = clamp(vasc + (vascGrowth - vascDecay) * subDt);
      }

      // === BACTERIA (planktonic) ===
      if (bac > 1e-6 || bio > 1e-6) {
        // S. aureus is a facultative anaerobe — grows aerobically via TCA cycle
        // and anaerobically via fermentation. Anaerobic generation time ~80 min vs
        // aerobic ~35 min (Belay & Rasooly 2002, PMID 11808796), giving anaerobic/aerobic
        // rate ratio of ~0.44. Using mm_o2 alone would incorrectly make growth zero
        // at zero O₂. Factor: 0.45 (anaerobic baseline) + 0.55 * mm_o2 (aerobic boost).
        const bacO2Factor = 0.45 + 0.55 * mm_o2;

        // Tissue-dependent carrying capacity: bacteria thrive in damaged tissue
        // (fibrin-rich, collagen-depleted, poorly vascularised) but cannot sustain
        // populations in intact tissue with functional immune surveillance and
        // intact epithelial/ECM barriers. In wound bed/surface, K=1 (full capacity).
        // In intact tissue, K is derived from damage state — K → 0 causes any
        // trace bacteria that diffuse in to die rapidly.
        const isWound = tissue === TissueType.WoundBed || tissue === TissueType.WoundSurface;
        const K_local = isWound ? 1.0 : Math.max(1e-3, clamp(fib * 0.6 + (1 - col) * 0.3 + (1 - vasc) * 0.1));
        const bacGrowth = p.mu_max * bac * (1 - (bac + bio) / K_local) * bacO2Factor;
        const bacKill = phagocytosis;
        const toBiofilm = bac > p.biofilm_threshold ? p.k_biofilm_transition * bac : 0;
        let abxKill = 0;
        if (abx > p.mic_threshold) {
          abxKill = p.k_abx_kill * (abx - p.mic_threshold) * bac;
        }
        bac = clamp(bac + (bacGrowth - bacKill - toBiofilm - abxKill) * subDt);

        // === BIOFILM ===
        const bioGrowth = toBiofilm;
        const bioKill = p.k_phag * neut * bio / p.biofilm_resistance;
        let bioAbxKill = 0;
        if (abx > p.mic_threshold) {
          bioAbxKill = p.k_abx_kill * (abx - p.mic_threshold) * bio / p.biofilm_resistance;
        }
        bio = clamp(bio + (bioGrowth - bioKill - bioAbxKill) * subDt);
      }

      // === ANTIBIOTIC ===
      if (antibioticStartTick !== null && currentTick >= antibioticStartTick) {
        const abxDelivery = antibioticDose * vasc * (1 - abx);
        const abxDecay = p.k_abx_decay * abx;
        abx = clamp(abx + (abxDelivery - abxDecay) * subDt);
      } else {
        const abxDecay = p.k_abx_decay * abx;
        abx = clamp(abx - abxDecay * subDt);
      }

      // Write back
      fields.keratinocyte[i] = kc;
      fields.fibroblast[i] = fb;
      fields.collagen[i] = col;
      fields.fibrin[i] = fib;
      fields.oxygen[i] = o2;
      fields.vascularDensity[i] = vasc;
      fields.neutrophil[i] = neut;
      fields.apoptoticNeutrophil[i] = neutApop;
      fields.macrophageM1[i] = m1;
      fields.macrophageM2[i] = m2;
      fields.tgfBeta[i] = tgf;
      fields.tnfAlpha[i] = tnf;
      fields.il10[i] = il10;
      fields.il1[i] = il1;
      fields.pdgf[i] = pdgf;
      fields.kgf[i] = kgf;
      fields.vegf[i] = vegf;
      fields.bacterialLoad[i] = bac;
      fields.biofilmLoad[i] = bio;
      fields.antibioticConc[i] = abx;
    }
  }
}
