/**
 * Pre-computed color lookup tables for each overlay mode.
 * Each LUT maps a normalized value [0, 1] to an RGBA pixel.
 */

const LUT_SIZE = 256;

export type ColorLUT = Uint8ClampedArray; // LUT_SIZE * 4 entries (RGBA)

function createLUT(colorFn: (t: number) => [number, number, number, number]): ColorLUT {
  const lut = new Uint8ClampedArray(LUT_SIZE * 4);
  for (let i = 0; i < LUT_SIZE; i++) {
    const t = i / (LUT_SIZE - 1);
    const [r, g, b, a] = colorFn(t);
    lut[i * 4] = r;
    lut[i * 4 + 1] = g;
    lut[i * 4 + 2] = b;
    lut[i * 4 + 3] = a;
  }
  return lut;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Oxygen: blue (low) → white → red (high) */
export const oxygenLUT = createLUT(t => [
  Math.round(lerp(30, 220, t)),
  Math.round(lerp(60, 60, t < 0.5 ? t * 2 : 2 - t * 2)),
  Math.round(lerp(200, 40, t)),
  255,
]);

/** Bacterial: black (none) → dark green → bright yellow-green (high) */
export const bacterialLUT = createLUT(t => [
  Math.round(lerp(20, 200, t)),
  Math.round(lerp(20, 220, t)),
  Math.round(lerp(20, 30, t)),
  255,
]);

/** Inflammatory: blue (low TNF-α) → red (high TNF-α) */
export const inflammatoryLUT = createLUT(t => [
  Math.round(lerp(40, 230, t)),
  Math.round(lerp(40, 50, t)),
  Math.round(lerp(180, 40, t)),
  255,
]);

/** Collagen: dark (none) → blue-purple (high) */
export const collagenLUT = createLUT(t => [
  Math.round(lerp(20, 100, t)),
  Math.round(lerp(20, 80, t)),
  Math.round(lerp(40, 220, t)),
  255,
]);

/** Look up a color from a LUT given a value in [0, 1] */
export function lookupColor(lut: ColorLUT, value: number): [number, number, number, number] {
  const idx = Math.min(LUT_SIZE - 1, Math.max(0, Math.round(value * (LUT_SIZE - 1))));
  return [
    lut[idx * 4],
    lut[idx * 4 + 1],
    lut[idx * 4 + 2],
    lut[idx * 4 + 3],
  ];
}
