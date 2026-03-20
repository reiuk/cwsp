/**
 * Thomas algorithm for solving tridiagonal systems.
 *
 * Solves: a[i]*x[i-1] + b[i]*x[i] + c[i]*x[i+1] = d[i]
 * for i = 0..n-1, with a[0] = 0 and c[n-1] = 0.
 *
 * This is O(n) and numerically stable for diagonally dominant systems,
 * which is guaranteed by our ADI formulation.
 *
 * Uses pre-allocated scratch arrays to avoid GC pressure.
 */

/** Scratch arrays — allocated once, reused */
const MAX_N = 100; // max dimension (NX or NY)
const c_prime = new Float64Array(MAX_N);
const d_prime = new Float64Array(MAX_N);

/**
 * Solve tridiagonal system in-place.
 * @param a - sub-diagonal (a[0] unused)
 * @param b - main diagonal
 * @param c - super-diagonal (c[n-1] unused)
 * @param d - right-hand side, overwritten with solution
 * @param n - system size
 */
export function thomasSolve(
  a: Float64Array,
  b: Float64Array,
  c: Float64Array,
  d: Float64Array,
  n: number,
): void {
  // Forward sweep
  c_prime[0] = c[0] / b[0];
  d_prime[0] = d[0] / b[0];

  for (let i = 1; i < n; i++) {
    const denom = b[i] - a[i] * c_prime[i - 1];
    c_prime[i] = c[i] / denom;
    d_prime[i] = (d[i] - a[i] * d_prime[i - 1]) / denom;
  }

  // Back substitution
  d[n - 1] = d_prime[n - 1];
  for (let i = n - 2; i >= 0; i--) {
    d[i] = d_prime[i] - c_prime[i] * d[i + 1];
  }
}
