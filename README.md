# CWSP

A browser simulation of acute wound healing, solved as a reaction-diffusion system.

**Live: [cwsp.juliuschandler.com](https://cwsp.juliuschandler.com/)**

It models a 10 x 5 mm cross-section of skin (a 100 x 50 grid at 0.1 mm per cell)
over 14 days at one-hour steps. Each cell carries 20 coupled state variables:
structural tissue (keratinocytes, fibroblasts, collagen, fibrin), vasculature and
oxygen, immune cells (neutrophils, apoptotic neutrophils, M1 and M2 macrophages),
seven cytokines (TGF-beta, TNF-alpha, IL-10, IL-1, PDGF, KGF, VEGF), bacterial and
biofilm load, and antibiotic concentration.

## The numerics

Each one-hour tick is a Strang split, so the operators stay second-order accurate
in time:

1. **Reactions, half step.** Local ODEs per cell, four sub-steps of forward Euler,
   Michaelis-Menten saturating kinetics throughout.
2. **Diffusion, full step.** Peaceman-Rachford ADI, unconditionally stable, with
   the Thomas algorithm solving each tridiagonal line in O(N).
3. **Chemotaxis, full step.** Upwind finite differences with CFL subcycling.
   Fibroblasts follow PDGF, neutrophils and M1 macrophages follow TNF-alpha,
   vasculature follows VEGF.
4. **Reactions, half step.** Same as (1), completing the Strang symmetry.

Boundaries are Neumann (zero flux) on all sides. Keratinocyte diffusion is masked
to substrate-supported regions, and bacterial diffusion is masked to damaged
tissue, so neither spreads through intact dermis.

## The biology worth knowing about

- **Fibrin acts as the DAMP.** The clot drives early immune recruitment through
  Hill kinetics, so inflammation decays on its own as fibrin is degraded and
  replaced by collagen, rather than being switched off by a timer.
- **Efferocytosis is the resolution loop.** Apoptotic neutrophils are phagocytosed
  by M1 macrophages, which produce IL-10, which drives the M1 to M2 switch. This
  is the whole inflammation-to-proliferation transition.
- **Oxygen gates everything.** Fibroblast proliferation, keratinocyte migration,
  collagen deposition and the neutrophil respiratory burst all require it, which
  is why the hypoxic scenario stalls rather than merely slowing.
- **Bacteria suppress healing along five paths at once:** sustaining M1
  polarisation via TLR signalling, impairing M2 function, degrading ECM, impairing
  keratinocyte migration, and forming biofilm with 100x antibiotic resistance.

## Scenarios and where they land

| Scenario                  | Closure by day 14 |
| ------------------------- | ----------------- |
| Normal acute wound        | ~100%             |
| S. aureus infection       | stalls at 20-30%  |
| Early antibiotic (6 hr)   | ~90%              |
| Delayed antibiotic (48hr) | ~98%, delayed     |
| Chronic hypoxic wound     | ~34%, fails       |

Finished runs stay on the charts as dashed lines, so scenarios overlay for
comparison. Bacterial load, vascular density and antibiotic timing and dose are
also adjustable directly.

## Architecture

Vite, React, TypeScript. The simulation runs in a web worker and hands state back
over transferable `ArrayBuffer`s, so the solver never blocks the UI thread. A
checkpoint every 24 ticks makes the timeline scrubbable in both directions.
Rendering goes through an offscreen 100 x 50 canvas scaled up with smoothing off
and pre-computed 256-entry colour LUTs, giving O(1) per-pixel colouring and exact
integer cell sizes.

```
src/simulation/   engine, fields, metrics, parameters, worker
src/simulation/solver/   adi, thomas, chemotaxis, reactions
src/rendering/    grid renderer and colour LUTs
src/components/   UI
```

## Parameters

Sourced from Menon, Flegg et al. (2012) *Proc. R. Soc. B* 279, 3329-3338;
Nagaraja et al. (2017, 2019) *Frontiers in Physiology*; Alves/Maddocks et al.
(2018); with the clinical timecourse from Singer & Clark (1999) *NEJM*. This
extends the Menon 1D framework to a 2D cross-section geometry.

`CWSP.md` and `CWSP_MVP_Scope_v2_Data_Grounded.md` hold the full derivation and
the calibration targets each rate constant was fitted against.

### Known limitations

Collagen is a single field, so it does not distinguish type III from type I and
cannot represent the remodelling ratio shift that continues well past day 14.

## Running it

```bash
npm install
npm run dev      # dev server
npm run build    # typecheck and production build
npm run preview  # serve the production build
```
