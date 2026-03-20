/**
 * ADI (Alternating Direction Implicit) diffusion solver.
 * Peaceman-Rachford scheme — unconditionally stable, O(N) per line.
 *
 * For the 2D diffusion equation:
 *   du/dt = D * (d²u/dx² + d²u/dy²)
 *
 * Split into two half-steps:
 *   Half-step 1 (implicit in x, explicit in y):
 *     (u* - uⁿ) / (dt/2) = D * [δxx(u*) + δyy(uⁿ)]
 *
 *   Half-step 2 (explicit in x, implicit in y):
 *     (uⁿ⁺¹ - u*) / (dt/2) = D * [δxx(u*) + δyy(uⁿ⁺¹)]
 *
 * Each half-step requires solving a tridiagonal system along each line.
 *
 * Mask support: when a mask is provided, cells with mask=0 are treated as
 * Neumann boundaries (zero-flux). Both the implicit AND explicit directions
 * respect the mask, preventing diffusion into/out of masked regions.
 */

import { NX, NY } from '../types';
import { thomasSolve } from './thomas';
import { applyNeumannBCSingle } from '../boundary';

// Pre-allocated tridiagonal system arrays
const a_arr = new Float64Array(Math.max(NX, NY));
const b_arr = new Float64Array(Math.max(NX, NY));
const c_arr = new Float64Array(Math.max(NX, NY));
const d_arr = new Float64Array(Math.max(NX, NY));

// Intermediate field (u*)
const uStar = new Float64Array(NX * NY);

/**
 * Get effective neighbor value for diffusion, respecting mask.
 * If the neighbor is masked out (mask=0), return the current cell value
 * (Neumann boundary — zero flux).
 */
function maskedNeighbor(
  field: Float64Array,
  centerIdx: number,
  neighborIdx: number,
  mask: Uint8Array | null | undefined,
): number {
  if (mask && mask[neighborIdx] === 0) {
    return field[centerIdx]; // reflect: zero-flux boundary
  }
  return field[neighborIdx];
}

/**
 * Perform one full ADI diffusion step on a single field.
 *
 * @param field - The field to diffuse (modified in-place)
 * @param D - Non-dimensional diffusion coefficient
 * @param dt - Timestep (1.0 = one tick)
 * @param mask - Optional mask: 0 = no diffusion at this cell, 1 = normal diffusion.
 */
export function adiDiffuse(
  field: Float64Array,
  D: number,
  dt: number,
  mask?: Uint8Array | null,
): void {
  if (D === 0) return;

  const r = D * dt * 0.5; // r = D * dt/2 (half-step coefficient)

  // --- Half-step 1: implicit in x, explicit in y ---
  for (let y = 1; y < NY - 1; y++) {
    // Build RHS: explicit in y (respecting mask)
    for (let x = 0; x < NX; x++) {
      const idx = y * NX + x;

      if (mask && mask[idx] === 0) {
        // Masked cell: no diffusion, keep current value
        d_arr[x] = field[idx];
        continue;
      }

      const uUp = maskedNeighbor(field, idx, (y - 1) * NX + x, mask);
      const uDown = maskedNeighbor(field, idx, (y + 1) * NX + x, mask);
      const uCenter = field[idx];

      // RHS = u + r * δyy(u) using mask-aware neighbors
      d_arr[x] = uCenter + r * (uUp - 2 * uCenter + uDown);
    }

    // Build tridiagonal coefficients for implicit x solve
    for (let x = 0; x < NX; x++) {
      const idx = y * NX + x;

      if (mask && mask[idx] === 0) {
        // Masked: identity row
        a_arr[x] = 0;
        b_arr[x] = 1;
        c_arr[x] = 0;
        d_arr[x] = field[idx];
      } else {
        const leftMasked = mask && x > 0 && mask[y * NX + (x - 1)] === 0;
        const rightMasked = mask && x < NX - 1 && mask[y * NX + (x + 1)] === 0;
        const activeNeighbors = (leftMasked ? 0 : 1) + (rightMasked ? 0 : 1);
        a_arr[x] = leftMasked ? 0 : -r;
        b_arr[x] = 1 + r * activeNeighbors;
        c_arr[x] = rightMasked ? 0 : -r;
      }
    }
    // Domain boundary: Neumann
    a_arr[0] = 0;
    if (!(mask && mask[y * NX] === 0)) {
      b_arr[0] = 1 + r; // one active neighbor (right)
    }
    c_arr[NX - 1] = 0;
    if (!(mask && mask[y * NX + NX - 1] === 0)) {
      b_arr[NX - 1] = 1 + r;
    }

    thomasSolve(a_arr, b_arr, c_arr, d_arr, NX);

    for (let x = 0; x < NX; x++) {
      uStar[y * NX + x] = d_arr[x];
    }
  }

  // Copy boundary rows
  for (let x = 0; x < NX; x++) {
    uStar[x] = uStar[NX + x];
    uStar[(NY - 1) * NX + x] = uStar[(NY - 2) * NX + x];
  }

  // --- Half-step 2: explicit in x, implicit in y ---
  for (let x = 1; x < NX - 1; x++) {
    // Build RHS: explicit in x using u* (respecting mask)
    for (let y = 0; y < NY; y++) {
      const idx = y * NX + x;

      if (mask && mask[idx] === 0) {
        d_arr[y] = uStar[idx];
        continue;
      }

      const uLeft = maskedNeighbor(uStar, idx, y * NX + (x - 1), mask);
      const uRight = maskedNeighbor(uStar, idx, y * NX + (x + 1), mask);
      const uCenter = uStar[idx];

      d_arr[y] = uCenter + r * (uLeft - 2 * uCenter + uRight);
    }

    // Build tridiagonal coefficients for implicit y solve
    for (let y = 0; y < NY; y++) {
      const idx = y * NX + x;

      if (mask && mask[idx] === 0) {
        a_arr[y] = 0;
        b_arr[y] = 1;
        c_arr[y] = 0;
        d_arr[y] = uStar[idx];
      } else {
        const upMasked = mask && y > 0 && mask[(y - 1) * NX + x] === 0;
        const downMasked = mask && y < NY - 1 && mask[(y + 1) * NX + x] === 0;

        const activeNeighbors = (upMasked ? 0 : 1) + (downMasked ? 0 : 1);
        a_arr[y] = upMasked ? 0 : -r;
        b_arr[y] = 1 + r * activeNeighbors;
        c_arr[y] = downMasked ? 0 : -r;
      }
    }
    // Domain boundary: Neumann
    a_arr[0] = 0;
    if (!(mask && mask[x] === 0)) {
      b_arr[0] = 1 + r;
    }
    c_arr[NY - 1] = 0;
    if (!(mask && mask[(NY - 1) * NX + x] === 0)) {
      b_arr[NY - 1] = 1 + r;
    }

    thomasSolve(a_arr, b_arr, c_arr, d_arr, NY);

    for (let y = 0; y < NY; y++) {
      field[y * NX + x] = d_arr[y];
    }
  }

  // Apply boundary conditions to final result
  applyNeumannBCSingle(field);
}
