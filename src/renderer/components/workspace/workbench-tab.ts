import type { LucideIcon } from 'lucide-react';
import type { ChannelId } from '../../../shared/channel.js';
import type { FileTone } from '../../lib/file-icon.js';
import type { SessionRowState } from '../../lib/session-attention.js';
import type { TabKind } from '../../lib/tab-tone.js';

export interface WorkbenchTab {
  id: string;
  /** What the tab shows: drives its tone (top rule, glyph) and its group in the tab switcher. */
  kind: TabKind;
  glyph: LucideIcon;
  label: string;
  /** Colours the glyph (file-type icons). */
  glyphTone?: FileTone | undefined;
  /** Pinned: shown as its icon alone, on the left behind a divider; the label becomes the tooltip. */
  pinned?: boolean;
  onClose?: () => void;
  /** Verb shown on the close control's tooltip/aria-label — e.g. "Minimizar" for a session tab whose process is still running, vs. "Fechar" once it isn't. Defaults to "Fechar". */
  closeLabel?: string;
  /**
   * Color of the 6px dot before this tab's label, shown whether or not the
   * tab is active — the signature that lets a user trace an open tab back to
   * its row in the side panels (skill/agent/instruction tabs use their
   * kind's role color). Tabs without one show no dot.
   */
  accentColor?: string;
  /** Skips the canvas's own content padding — for tabs (like the entity editor) that manage their own internal spacing edge-to-edge. */
  dense?: boolean;
  /** A session tab's live state: shown as the four-state mark beside the label. */
  sessionState?: SessionRowState;
  /** The channel a session tab runs on: with `sessionState`, the tab draws one channel mark badged with the state instead of two icons. */
  sessionChannel?: ChannelId;
  /** What that state is about ("Edit · 12 s", "Permissão: Bash") — appended to the state name in the tab's tooltip. */
  sessionDetail?: string;
  /** Unsaved-changes indicator — a small dot next to the label, same signal a `closeTab`/scope-switch discard guard reads to decide whether to confirm. */
  dirty?: boolean;
  /**
   * Path-like context for this tab, browser-address-bar style (e.g.
   * "brand › INSTRUCTIONS", "apps › src › a.md") — shown only while this tab
   * is active. A tab's own label is often just the scope's name (an
   * instruction's `entity.name` is its project/workspace's own basename), so
   * two unrelated tabs can carry the exact same label; the breadcrumb is what
   * actually disambiguates them. Omitted for tabs with no real path (a
   * session, a preview, Histórico).
   */
  breadcrumb?: string;
  /** Renders the glyph alone — the label becomes the tooltip and aria-label. For the pinned "Visão geral" tab. */
  iconOnly?: boolean;
  /** Rendered for every open tab on every render, not just the active one — visibility is a `display` toggle (via the `hidden` arg), never a mount/unmount, so scroll position survives switching away and back. */
  render: (hidden: boolean) => React.ReactNode;
}
