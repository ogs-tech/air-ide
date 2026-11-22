import type { PaletteMode } from '@mui/material/styles';
import type { ITheme } from '@xterm/xterm';
import { ogs, surfaces } from '../tokens.js';

// One palette for every xterm in the app. Both modes keep each of the 16 ANSI
// colours at >= 3:1 against the background (checked in terminal-theme.test.ts),
// because CLI output picks its own colours and must stay legible on either one.
const LIGHT: ITheme = {
  background: surfaces.light.input,
  foreground: ogs.ink,
  cursor: '#3D5CC2',
  cursorAccent: surfaces.light.input,
  selectionBackground: 'rgba(61,92,194,0.22)',
  black: '#142036',
  red: '#B3322A',
  green: '#0E7A40',
  yellow: '#8A6200',
  blue: '#3D5CC2',
  magenta: '#9A3FA6',
  cyan: '#0B7285',
  white: '#6A7080',
  brightBlack: '#5A6573',
  brightRed: '#C9453B',
  brightGreen: '#12803F',
  brightYellow: '#946A00',
  brightBlue: '#4F6FDB',
  brightMagenta: '#AD4EBA',
  brightCyan: '#0F8399',
  brightWhite: '#7A7E89',
};

const DARK: ITheme = {
  background: ogs.ink,
  foreground: ogs.creamInk,
  cursor: '#5B79E0',
  cursorAccent: ogs.ink,
  selectionBackground: 'rgba(91,121,224,0.35)',
  black: '#6B7689',
  red: '#E2675A',
  green: '#3FB97A',
  yellow: '#E5B547',
  blue: '#7C95EA',
  magenta: '#C48BD0',
  cyan: '#56C2D6',
  white: '#C9CDD4',
  brightBlack: '#8590A3',
  brightRed: '#F08377',
  brightGreen: '#63D196',
  brightYellow: '#F2CB6B',
  brightBlue: '#97ACF2',
  brightMagenta: '#D8A6E2',
  brightCyan: '#7AD6E6',
  brightWhite: '#F2EEE5',
};

export function terminalTheme(mode: PaletteMode): ITheme {
  return { ...(mode === 'dark' ? DARK : LIGHT) };
}

function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  const channel = (v: number): number => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255);
}

/** WCAG contrast ratio between two `#rrggbb` colours. */
export function contrastRatio(fg: string, bg: string): number {
  const [hi, lo] = [luminance(fg), luminance(bg)].sort((a, b) => b - a) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

/** `#rrggbb` as the X11 `rgb:rrrr/gggg/bbbb` form terminals answer OSC 10/11 colour queries with. */
export function oscColor(hex: string): string {
  const [r, g, b] = [1, 3, 5].map((i) => hex.slice(i, i + 2));
  return `rgb:${r}${r}/${g}${g}/${b}${b}`.toLowerCase();
}
