import type { Theme } from '@mui/material/styles';
import type { ChannelId } from '../../shared/channel.js';
import { CLAUDE_BRAND_COLOR } from '../components/ChannelMark.js';

export type TabKind =
  | 'overview'
  | 'session'
  | 'file'
  | 'git-diff'
  | 'browser'
  | 'skill'
  | 'agent'
  | 'instruction'
  | 'mcp'
  | 'preview'
  | 'terminal'
  | 'history'
  | 'config';

/** Top-rule / glyph colour for a Workbench tab kind. */
export function tabToneColor(theme: Theme, kind: TabKind, channel?: ChannelId): string {
  const { palette } = theme;
  switch (kind) {
    case 'session':
      if (channel === 'cursor') return palette.info.main;
      if (channel === 'lmstudio') return palette.success.main;
      return CLAUDE_BRAND_COLOR;
    case 'file':
    case 'browser':
    case 'preview':
      return palette.info.main;
    case 'git-diff':
    case 'mcp':
      return palette.success.main;
    case 'skill':
    case 'agent':
    case 'instruction':
      return palette.primary.main;
    case 'terminal':
    case 'history':
    case 'config':
    case 'overview':
      return palette.text.secondary;
  }
}
