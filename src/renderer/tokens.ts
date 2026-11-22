// src/renderer/tokens.ts
// OGS Design System v1.0 (2026) — raw brand tokens. Consumed by theme.ts.
// "Cream is the paper, Ink is the stroke." One chromatic role at a time:
// azul = action/link, verde = success/active, ambar = premium/attention,
// erro = error. Ink is the neutral accent; azul is the default Button colour.
// Shell panels are bordered `paper` cards on the `canvas` — still "fio antes
// de sombra" (hairline border, no shadow); `rail` is a fill for selection,
// hover and segmented-control tracks, never a panel background.

export const ogs = {
  ink: '#142036',
  cream: '#F7F4EE',
  /** Cream tint used for ink-on-dark text and dark-mode filled-button text. */
  creamInk: '#F2EEE5',
} as const;

export const colorRoles = {
  light: {
    azul: '#3D5CC2',
    verde: '#119350',
    ambar: '#D9A12C',
    erro: '#C0392B', // §13: confirm with brand
    slate: '#7A7E89',
  },
  dark: {
    azul: '#5B79E0',
    verde: '#3FB97A',
    ambar: '#E5B547',
    erro: '#E2675A',
    slate: '#9AA0A8',
  },
} as const;

/** Surface tokens that have no MUI palette slot. */
export const surfaces = {
  light: { canvas: '#F7F4EE', paper: '#FFFFFF', rail: '#F2EEE5', input: '#FBFAF6' },
  dark: { canvas: '#0F1828', paper: '#16223A', rail: '#1B2944', input: '#16223A' },
} as const;

/**
 * Workbench chrome (tab strip, active tab, session footer, diff bodies).
 * The strip sits one step *below* `rail` so the active tab — `paper` — reads
 * as joined to the content; the footer stays in the `input` family so it
 * matches the terminal body in both modes.
 */
export const workbench = {
  light: {
    strip: '#E6E0D2',
    tabActive: '#FFFFFF',
    tabHover: '#EEE9DC',
    footer: '#F3F0E7',
    footerMuted: '#5A6573',
    diffAdd: 'rgba(17,147,80,0.12)',
    diffRemove: 'rgba(192,57,43,0.12)',
  },
  dark: {
    strip: '#0B1320',
    tabActive: '#16223A',
    tabHover: '#111B2E',
    footer: '#1A2740',
    footerMuted: '#9AA0A8',
    diffAdd: 'rgba(63,185,122,0.16)',
    diffRemove: 'rgba(226,103,90,0.16)',
  },
} as const;

export const text = {
  light: { primary: '#142036', secondary: '#5A6573' },
  dark: { primary: '#F2EEE5', secondary: '#9AA0A8' },
} as const;

export const divider = {
  light: 'rgba(20,32,54,0.11)',
  dark: 'rgba(255,255,255,0.08)',
} as const;

export const radius = { xs: 6, sm: 10, md: 14, lg: 20, pill: 999 } as const;

export const shadow = {
  sm: '0 1px 2px rgba(20,32,54,0.06), 0 1px 3px rgba(20,32,54,0.10)',
  md: '0 4px 12px rgba(20,32,54,0.12)',
  lg: '0 12px 32px rgba(20,32,54,0.18)',
} as const;

export const fonts = {
  sans: '"Space Grotesk", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  mono: '"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace',
} as const;

export type ThemeColorRole = keyof typeof colorRoles.light;
