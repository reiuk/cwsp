# Addendum: Path to Production 3D Wound Simulation

## Current State

The existing codebase is a 2D reaction-diffusion-chemotaxis demo on a uniform 100×50 Cartesian grid, solved via ADI (Peaceman-Rachford) with Strang operator splitting. 19 coupled fields, JS/TypeScript, runs in-browser via Web Worker. Good for communication and hypothesis exploration — not suited for real wound geometry.

## Why 3D on this stack doesn't work

Combat wounds (tunneling, undermining, sinus tracts, irregular cavities) cannot be represented on a uniform Cartesian grid. The fundamental requirements:

- **Unstructured tetrahedral meshes** from patient imaging (CT/MRI → segmentation → tet mesh)
- **FEM/FVM solvers** — ADI doesn't apply on unstructured meshes
- **Sparse linear solvers** (CG, GMRES, AMG) instead of Thomas algorithm
- **Implicit time integration** for stiff reaction kinetics (not fixed sub-stepping)
- **Adaptive mesh refinement** near wound margins
- **HPC backend** — millions of DOFs × 19 fields can't run in a browser

## Framework Evaluation

### Recommended: FEniCSx

- **Language**: Python frontend, C++ backend
- **License**: LGPL v3
- **Status**: Very actively maintained (daily commits, v0.10.0, 1,000+ GitHub stars)
- **Why it fits**: UFL (Unified Form Language) lets you express coupled PDEs symbolically — auto-generates optimized C assembly code. Native unstructured tet mesh support via Gmsh. Parallel via PETSc/MPI. Demonstrated at 8,192+ MPI processes.

Example for one field:

```python
F_oxygen = (
    (o2 - o2_n)/dt * v * dx
    + D_o2 * inner(grad(o2), grad(v)) * dx
    + k_consume * fibroblast * o2 * v * dx
    - k_supply * vascular * (1.0 - o2) * v * dx
)
```

19 such forms, summed, solved. Framework handles meshing, assembly, solving, parallelism, AMR.

### Strong alternative: MOOSE

- **Language**: C++
- **License**: LGPL v2.1
- **Status**: Very actively maintained (2,100+ GitHub stars, Idaho National Lab)
- **Why it fits**: Kernel-based architecture — each PDE term is a modular Kernel class composed in input files. Built-in fully-implicit Newton solves handle stiff coupling. Built on libMesh + PETSc. More boilerplate than FEniCSx but more structured.
- **Trade-off**: No UFL-like DSL, so expressing 19 coupled fields requires more manual C++ setup.

### Honorable mentions

- **Firedrake**: Nearly identical to FEniCSx. Better adjoint/optimization support (useful for parameter estimation against clinical data). Slightly smaller community.
- **deal.II**: Maximum AMR and HPC scalability. C++ only, most manual setup. 1,600+ stars, very mature.

### Not suitable

| Framework | Reason |
|---|---|
| PhysiCell | Cartesian grid only — cannot represent patient-specific geometry |
| CompuCell3D | Lattice-based Cellular Potts, wrong abstraction level for continuum PDEs |
| CHASTE | PDE solver too basic for 19 coupled continuum fields; oriented toward cell-population models |
| OpenCMISS | Effectively unmaintained since 2018 |

## Why hybrid continuum/discrete, not pure ABM or pure PDE

Different parts of wound biology require different abstractions:

**Continuum PDE is correct for host tissue and cytokines.** Host cells (keratinocytes, fibroblasts, immune cells) are present at high densities and their collective behaviour is well-described by reaction-diffusion equations — the prototype proves this, and the published wound healing modelling literature (Menon et al. 2012, Nagaraja et al. 2017, Sherratt & Murray 1990, Olsen et al. 1995) is overwhelmingly continuum. Cytokines, oxygen, and ECM components are diffusible fields at high concentrations. FEM on unstructured meshes gives proper adaptive refinement, implicit time integration, and scalable linear algebra via PETSc — a quality gap that ABM frameworks (PhysiCell, CompuCell3D) cannot match for stiff coupled multi-scale PDEs.

**Continuum breaks for AMR evolution, biofilm, and polymicrobial interactions.** A resistance mutation occurs in one bacterium that clonally expands under selective pressure. Horizontal gene transfer is a discrete event between two organisms. These are population genetics problems that cannot be represented as continuous density fields — a continuum "resistance level" would be hand-waving. Biofilm is a spatially structured community with heterogeneous metabolic states, diffusion barriers, and persister subpopulations. Pioneer colonisation (S. aureus facilitating P. aeruginosa, Alves/Hooper 2018) and spatial partitioning within biofilms (Beeton et al. 2023) are spatially local stochastic processes. Stochastic infection establishment — whether a small inoculum survives initial immune clearance — is binary at low numbers and poorly captured by a continuous density of 0.001.

**Pure ABM doesn't scale.** A real wound contains ~10⁸–10¹⁰ bacteria and millions of host cells. ABM frameworks handle thousands to low millions of agents — orders of magnitude short. Cytokine/oxygen diffusion must be solved on a mesh regardless. Validation against published wound healing curves (all continuum models) requires ensemble averaging over stochastic runs, which is slower and noisier.

**The hybrid architecture:**

- **Tissue Engine (continuum):** Host cell densities, cytokines, oxygen, ECM on unstructured FEM mesh via FEniCSx. Extends the validated prototype framework to 3D patient-specific geometry.
- **Microbial Engine (discrete agents on the tissue mesh):** Bacterial and fungal subpopulations as spatially located "super-agents" (~10³–10⁴ organisms each), each carrying species identity, resistance profiles, and biofilm/morphological state. Stochastic mutation, HGT, quorum sensing, biofilm transition.
- **Coupling (every timestep):** Agents → continuum: bacteria consume O₂, produce toxins, trigger TLR signalling. Continuum → agents: immune cell density determines phagocytosis rate, O₂/nutrient levels determine growth rate, antibiotic concentration determines kill rate.

## Target Architecture

```
Clinical imaging (CT/MRI/structured light scanning)
    ↓
Segmentation pipeline (e.g., 3D Slicer, ITK-SNAP)
    ↓
Mesh generation (Gmsh, CGAL, or Simpleware)
    ↓
3D unstructured tet mesh + tissue labels
    ↓
FEniCSx solver (HPC backend)
  Tissue Engine (continuum FEM):
  - Host cell densities, cytokines, O₂, ECM
  - Validated kinetics from prototype, expressed as UFL weak forms
  - Adaptive mesh refinement
  - Implicit time integration (BDF via PETSc TS or SUNDIALS)
  - Block preconditioning for the coupled system
  Microbial Engine (discrete agents on mesh):
  - Bacterial super-agents located on mesh elements
  - Species-specific growth, resistance profiles, biofilm state
  - Stochastic: mutation, HGT, quorum sensing
  - Coupled to continuum fields at every timestep
    ↓
Results store (HDF5/VTK time series of 3D fields + agent trajectories)
    ↓
Web frontend (current React app, adapted)
  - Orthogonal slice visualization through precomputed results
  - Depth/plane selector
  - Parameter exploration and scenario comparison
  - Optional 3D orientation wireframe (Three.js)
```

The browser becomes a **viewer**, not the simulation engine. The current React frontend, canvas rendering, scenario comparison UI, and parameter controls remain valuable as the presentation layer.

## Validation requirements for production

1. **Rate constants**: Every parameter in the reaction kinetics needs sourcing to experimental data or calibration against clinical wound trajectory datasets
2. **Sensitivity analysis**: Identify which of the 60+ parameters actually drive outcomes
3. **Verification**: Method of manufactured solutions, mesh convergence studies
4. **Validation**: Compare predictions against clinical data (wound area over time, bacterial burden, time-to-closure)
5. **Regulatory**: If informing clinical decisions, FDA 510(k) or De Novo pathway for clinical decision support software

## What the current codebase contributes

- **Reaction kinetics model** (`src/simulation/solver/reactions.ts`): 200+ lines of coupled ODEs encoding wound biology — needs validation but the model structure translates directly to FEniCSx weak forms
- **Parameter system** (`src/simulation/parameters.ts`): Diffusion coefficients, rate constants, half-saturation constants — baseline values to calibrate from
- **Scenario framework**: Normal, infected, early/late antibiotic, hypoxic — these become FEniCSx initial condition configurations
- **Frontend**: Slice rendering, overlay modes, timeline controls, run comparison — reusable as the visualization layer

## Key risks

- **Mesh quality from patient imaging**: Segmentation → clean tet mesh is non-trivial for irregular wound geometries. May need manual cleanup or robust remeshing.
- **Solver performance**: 19 coupled fields × millions of DOFs → large block systems. Block preconditioning strategy is critical (field-split with AMG sub-blocks via PETSc).
- **Stiffness**: Bacterial doubling (~83 min) vs collagen remodeling (~weeks) spans 4+ orders of magnitude in timescale. Implicit integrators are essential.
- **Parameter identifiability**: 60+ parameters with limited clinical calibration data. Risk of overfitting to noise.
