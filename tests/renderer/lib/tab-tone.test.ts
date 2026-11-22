import { describe, it, expect } from 'vitest';
import { createAppTheme } from '../../../src/renderer/theme.js';
import { tabToneColor } from '../../../src/renderer/lib/tab-tone.js';
import { CLAUDE_BRAND_COLOR } from '../../../src/renderer/components/ChannelMark.js';

describe.each(['light', 'dark'] as const)('tabToneColor (%s)', (mode) => {
  const theme = createAppTheme(mode);
  const { palette } = theme;

  it('tints files, browser and preview blue', () => {
    expect(tabToneColor(theme, 'file')).toBe(palette.info.main);
    expect(tabToneColor(theme, 'browser')).toBe(palette.info.main);
    expect(tabToneColor(theme, 'preview')).toBe(palette.info.main);
  });

  it('tints git diffs and MCP green', () => {
    expect(tabToneColor(theme, 'git-diff')).toBe(palette.success.main);
    expect(tabToneColor(theme, 'mcp')).toBe(palette.success.main);
  });

  it('tints sessions by channel', () => {
    expect(tabToneColor(theme, 'session', 'claude')).toBe(CLAUDE_BRAND_COLOR);
    expect(tabToneColor(theme, 'session', 'cursor')).toBe(palette.info.main);
    expect(tabToneColor(theme, 'session', 'lmstudio')).toBe(palette.success.main);
  });

  it('keeps terminal, history, config and overview neutral', () => {
    for (const kind of ['terminal', 'history', 'config', 'overview'] as const) {
      expect(tabToneColor(theme, kind)).toBe(palette.text.secondary);
    }
  });

  it('uses the accent for skill, agent and instruction', () => {
    for (const kind of ['skill', 'agent', 'instruction'] as const) {
      expect(tabToneColor(theme, kind)).toBe(palette.primary.main);
    }
  });
});
