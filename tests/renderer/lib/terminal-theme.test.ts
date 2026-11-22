import { describe, it, expect } from 'vitest';
import { terminalTheme, contrastRatio, oscColor } from '../../../src/renderer/lib/terminal-theme.js';

const ANSI = [
  'black', 'red', 'green', 'yellow', 'blue', 'magenta', 'cyan', 'white',
  'brightBlack', 'brightRed', 'brightGreen', 'brightYellow', 'brightBlue', 'brightMagenta', 'brightCyan', 'brightWhite',
] as const;

describe('contrastRatio', () => {
  it('is 21 for black on white and 1 for identical colours', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 1);
    expect(contrastRatio('#336699', '#336699')).toBeCloseTo(1, 5);
  });
});

describe.each(['light', 'dark'] as const)('terminalTheme (%s)', (mode) => {
  const theme = terminalTheme(mode);
  const bg = theme.background as string;

  it('has body text at AAA contrast', () => {
    expect(contrastRatio(theme.foreground as string, bg)).toBeGreaterThanOrEqual(7);
  });

  it.each(ANSI)('keeps %s legible on the background', (key) => {
    expect(contrastRatio(theme[key] as string, bg)).toBeGreaterThanOrEqual(3);
  });

  it('distinguishes the selection from the background', () => {
    expect(theme.selectionBackground).toBeTruthy();
    expect(theme.selectionBackground).not.toBe(bg);
  });
});

describe('terminalTheme backgrounds', () => {
  it('uses the input surface in light and ink in dark', () => {
    expect(terminalTheme('light').background).toBe('#FBFAF6');
    expect(terminalTheme('dark').background).toBe('#142036');
  });
});

describe('oscColor', () => {
  it('formats #rrggbb the way terminals answer OSC colour queries', () => {
    expect(oscColor('#FBFAF6')).toBe('rgb:fbfb/fafa/f6f6');
  });
});
