/**
 * Boundary condition application.
 *
 * Neumann (zero-flux) on all domain boundaries — nothing leaves the simulation.
 * Dirichlet conditions at wound margins for oxygen (fixed at vasculature value).
 */

import { NX, NY, SimulationFields, FIELD_NAMES } from './types';

/**
 * Apply zero-flux (Neumann) boundary conditions by copying
 * nearest interior values to boundary cells.
 *
 * For a 2D grid, this means:
 *   top row (y=0): copy from y=1
 *   bottom row (y=NY-1): copy from y=NY-2
 *   left column (x=0): copy from x=1
 *   right column (x=NX-1): copy from x=NX-2
 */
export function applyBoundaryConditions(fields: SimulationFields): void {
  for (const name of FIELD_NAMES) {
    applyNeumannBC(fields[name]);
  }
}

function applyNeumannBC(field: Float64Array): void {
  // Top and bottom rows
  for (let x = 0; x < NX; x++) {
    field[x] = field[NX + x];                         // y=0 ← y=1
    field[(NY - 1) * NX + x] = field[(NY - 2) * NX + x]; // y=NY-1 ← y=NY-2
  }
  // Left and right columns
  for (let y = 0; y < NY; y++) {
    field[y * NX] = field[y * NX + 1];                 // x=0 ← x=1
    field[y * NX + NX - 1] = field[y * NX + NX - 2]; // x=NX-1 ← x=NX-2
  }
}

/**
 * Apply Neumann BC to a single field (used during ADI sub-steps).
 */
export function applyNeumannBCSingle(field: Float64Array): void {
  applyNeumannBC(field);
}
