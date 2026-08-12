/**
 * Shared visual tokens. Kept in one place so the instrument reads as one object
 * rather than a pile of independently-styled panels.
 */

export const c = {
  bg: '#0d0e10',
  surface: '#15171a',
  surfaceHi: '#1c1f23',
  line: '#282c31',
  lineSoft: '#1f2327',

  text: '#e8eaec',
  dim: '#98a0a8',
  faint: '#697079',

  accent: '#5eb3e4',
  accentDim: '#2a4d63',
  accentFill: '#17303f',

  good: '#5ec27f',
  warn: '#e0a13f',
  bad: '#e0644a',
} as const;

export const font = {
  sans: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif',
  mono: 'ui-monospace, "SF Mono", "JetBrains Mono", Menlo, Consolas, monospace',
} as const;

/** Section heading above each control group. */
export const labelStyle: React.CSSProperties = {
  color: c.faint,
  fontSize: 10,
  fontWeight: 600,
  letterSpacing: '0.09em',
  textTransform: 'uppercase',
  fontFamily: font.mono,
};
