# CWSP — Computational Wound Simulation Platform

## What it is

A browser-based 2D reaction-diffusion simulation of acute excisional wound healing. It models a 10mm × 5mm tissue cross-section (100×50 grid, 0.1mm cells) over 14 days, tracking 20 state variables per cell — structural tissue (keratinocytes, fibroblasts, collagen, fibrin), vasculature, immune cells (neutrophils, M1/M2 macrophages), 7 cytokines (TGF-β, TNF-α, IL-10, IL-1, PDGF, KGF, VEGF), bacteria/biofilm, and antibiotic concentration.

## How the simulation works

**Strang operator splitting** per 1-hour tick:

1. **Reactions (half-step)** — Local ODEs at each cell, 4 sub-steps of forward Euler. Michaelis-Menten saturating kinetics throughout. Models: immune recruitment/apoptosis, M1→M2 polarization (IL-10/efferocytosis-driven), cytokine production/decay, fibroblast/keratinocyte proliferation, collagen deposition, fibrin degradation, bacterial growth, biofilm formation, phagocytosis, antibiotic killing.

2. **Diffusion (full step)** — Peaceman-Rachford ADI (alternating direction implicit), unconditionally stable. Thomas algorithm solves tridiagonal systems in O(N). Diffusion coefficients are non-dimensionalized; oxygen diffuses fast (D=7.2), cytokines moderate (D≈3.6), cells slow (D≈0.18). Keratinocyte diffusion is dynamically masked to substrate-supported regions.

3. **Chemotaxis (full step)** — Upwind finite differences with CFL subcycling. Fibroblasts chase PDGF, neutrophils/M1s chase TNF-α, vasculature follows VEGF.

4. **Reactions (half-step)** — Same as step 1 (Strang symmetry).

## Key biological mechanisms

- **Fibrin as DAMP** — The clot drives early immune recruitment via Hill kinetics; as fibrin degrades and collagen replaces it, inflammatory stimulus naturally decays.
- **Efferocytosis loop** — Apoptotic neutrophils → M1 phagocytosis → IL-10 → M1→M2 switch → resolution. This is the core inflammation-to-proliferation transition.
- **O₂ gates everything** — Fibroblast proliferation, keratinocyte migration, collagen deposition, and neutrophil respiratory burst all require oxygen. Hypoxia stalls healing.
- **Bacteria suppress healing multiply** — Sustain M1 polarization (block M1→M2 switch via TLR), impair M2 function, degrade ECM, impair keratinocyte migration, form biofilm (100× resistance).
- **Wound maturity dampening** — Collagen accumulation suppresses immune recruitment (1/(1+5×col²)), preventing non-physical M1 rebound in late healing.

## Scenarios

| Scenario | Outcome |
|----------|---------|
| Normal | ~100% closure by day 12-14 |
| S. aureus infection | Stalls at 20-30% |
| Early antibiotic (6hr) | ~90% closure |
| Delayed antibiotic (48hr) | ~98% (delayed) |
| Chronic hypoxic | ~34% (fails) |

## Architecture

Vite + React + TypeScript. Simulation runs in a **Web Worker** (separate thread), communicating via transferable ArrayBuffers (zero-copy). A checkpoint store (every 24 ticks) enables timeline scrubbing. Rendering uses an offscreen 100×50 canvas scaled 7× to display, with pre-computed 256-entry color LUTs for O(1) pixel coloring. 5 overlay modes (tissue composition, oxygen, bacteria, inflammation, collagen). 4 Recharts line charts track wound closure, bacterial load, inflammatory ratio, and collagen density across runs.

## Parameters

All sourced from Menon, Flegg et al. (2012) Proc. R. Soc. B 279, 3329–3338, Nagaraja et al. (2017, 2019), Singer & Clark (1999) NEJM for clinical timecourse, and clinical wound microbiology data. Users can adjust bacterial load, vascular density, antibiotic timing, and antibiotic dose via sliders.
