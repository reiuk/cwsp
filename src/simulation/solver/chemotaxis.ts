/**
 * Upwind chemotaxis solver with CFL subcycling.
 *
 * Chemotaxis flux: J = χ * u * ∇c
 * where u is the cell density and c is the chemoattractant.
 *
 * Uses upwind differencing for stability:
 *   If flow is to the right (dc/dx > 0), use left-biased difference for u
 *   If flow is to the left (dc/dx < 0), use right-biased difference for u
 *
 * CFL condition: dt < dx / (χ * max|∇c|)
 * If violated, subcycle with smaller timesteps.
 */

import { NX, NY, NCELLS, SimulationFields } from '../types';
import { ChemotaxisSpec } from '../types';

// Pre-allocated flux arrays
const fluxX = new Float64Array(NCELLS);
const fluxY = new Float64Array(NCELLS);

/**
 * Apply chemotaxis for one field-attractant pair.
 *
 * @param fields - All simulation fields
 * @param spec - Chemotaxis specification (field, attractant, chi)
 * @param dt - Timestep
 * @param mask - Optional mask for constrained fields
 */
export function applyChemotaxis(
  fields: SimulationFields,
  spec: ChemotaxisSpec,
  dt: number,
  mask?: Uint8Array | null,
): void {
  const u = fields[spec.field];
  const c = fields[spec.attractant];
  const chi = spec.chi;

  if (chi === 0) return;

  // Compute max face gradient for CFL check
  let maxGrad = 0;
  for (let y = 1; y < NY - 1; y++) {
    for (let x = 0; x < NX - 1; x++) {
      const idx = y * NX + x;
      const g = Math.abs(c[idx + 1] - c[idx]);
      if (g > maxGrad) maxGrad = g;
    }
  }
  for (let y = 0; y < NY - 1; y++) {
    for (let x = 1; x < NX - 1; x++) {
      const idx = y * NX + x;
      const g = Math.abs(c[(y + 1) * NX + x] - c[idx]);
      if (g > maxGrad) maxGrad = g;
    }
  }

  if (maxGrad < 1e-12) return; // no gradient, nothing to do

  // CFL subcycling
  const cflDt = 0.4 / (chi * maxGrad); // safety factor 0.4
  const nSub = Math.max(1, Math.ceil(dt / cflDt));
  const subDt = dt / nSub;

  for (let sub = 0; sub < nSub; sub++) {
    // Compute face-based fluxes using proper upwind scheme.
    // At face (i+1/2, j): flux_x = chi * u_upwind * (c[i+1,j] - c[i,j])
    //   u_upwind = u[i,j]   if c[i+1] > c[i] (flow to right → use left value)
    //   u_upwind = u[i+1,j] if c[i+1] < c[i] (flow to left → use right value)
    fluxX.fill(0);
    fluxY.fill(0);

    // X-direction face fluxes: fluxX[idx] stores flux at face (x+1/2, y)
    for (let y = 1; y < NY - 1; y++) {
      for (let x = 0; x < NX - 1; x++) {
        const idx = y * NX + x;
        const idxR = idx + 1;

        if (mask && (mask[idx] === 0 || mask[idxR] === 0)) continue;

        const dcdx = c[idxR] - c[idx]; // gradient at face
        const uFace = dcdx >= 0 ? u[idx] : u[idxR]; // upwind value
        fluxX[idx] = chi * uFace * dcdx;
      }
    }

    // Y-direction face fluxes: fluxY[idx] stores flux at face (x, y+1/2)
    for (let y = 0; y < NY - 1; y++) {
      for (let x = 1; x < NX - 1; x++) {
        const idx = y * NX + x;
        const idxD = (y + 1) * NX + x;

        if (mask && (mask[idx] === 0 || mask[idxD] === 0)) continue;

        const dcdy = c[idxD] - c[idx]; // gradient at face
        const uFace = dcdy >= 0 ? u[idx] : u[idxD]; // upwind value
        fluxY[idx] = chi * uFace * dcdy;
      }
    }

    // Update field using conservative flux divergence:
    // du/dt = -div(J) = -(J_{i+1/2} - J_{i-1/2})/dx - (J_{j+1/2} - J_{j-1/2})/dy
    // With dx=dy=1 in non-dimensional coordinates.
    for (let y = 1; y < NY - 1; y++) {
      for (let x = 1; x < NX - 1; x++) {
        const idx = y * NX + x;
        if (mask && mask[idx] === 0) continue;

        const divFlux =
          (fluxX[idx] - fluxX[idx - 1]) +            // x-face divergence
          (fluxY[idx] - fluxY[(y - 1) * NX + x]);    // y-face divergence

        u[idx] -= subDt * divFlux;

        if (u[idx] < 0) u[idx] = 0;
      }
    }
  }
}

/**
 * Apply all chemotaxis terms.
 */
export function applyAllChemotaxis(
  fields: SimulationFields,
  specs: ChemotaxisSpec[],
  dt: number,
  keratMask: Uint8Array | null,
): void {
  for (const spec of specs) {
    const mask = spec.field === 'keratinocyte' ? keratMask : null;
    applyChemotaxis(fields, spec, dt, mask);
  }
}
