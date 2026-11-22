# Workbench tabs + light/dark refinement — design

Status: updated after mockup validation (2026-11-21). Mockups were shown in the visual companion: tab options, tab kinds gallery, session footer. Open items are listed at the end.

## Intent

The Workbench tab strip breaks with many tabs and is hard to read in both themes; the terminal and the session footer are dark-only inside a light app. Refactor the tab strip, tab kinds, terminals and session footer so they are legible, scale from 4 to 40 tabs, and have light/dark parity.

## Goals

1. **Tabs never push tabs out of sight.** Inactive tabs shrink (glyph + state dot when tight); the active one keeps its full label. (Option C, chosen.)
2. **Tab switcher** (search, grouped by kind, per-session state) replaces the plain "Todas as abas" menu. A needs-input count (amber) shows on its button even when those tabs are hidden.
3. **Active tab is clearly selected in both themes**: paper surface, border, top rule in the tab kind's tone, joined to the content. The strip is darker than the content.
4. **Tab kinds get a tone** (top rule + glyph color, from tokens): session = Claude accent / Cursor blue / LM Studio green, file = blue, git diff = green, browser = blue, skill/agent/instruction = accent, MCP = green, preview = blue, terminal / history / config = neutral. Config and Visão geral are icon-only fixed tabs (existing `iconOnly`/`pinned`).
5. **Session tabs are truthful**: the real title when one exists, "Nova sessão" instead of "Untitled", a persistent state dot (running / needs input / idle / closed) in addition to the existing attention ring.
6. **Terminals follow the app theme** (light terminal in the light app, dark in the dark app). Replace the two hard-coded `TERMINAL_XTERM_THEME` copies (`SessionPanel.tsx:89`, `TerminalPanel.tsx:12`, both `ogs.ink`) and the `bgcolor: ogs.ink` wrappers (`SessionPanel.tsx:597`, `TerminalPanel.tsx:127`) with one shared `terminalTheme(mode)`: background, foreground, cursor, selection and a 16-color ANSI palette per mode, each color checked for contrast on its background. Both panels apply it on mount and update `terminal.options.theme` live on a mode change, with no remount (sessions keep running). Light proposal: `surfaces.light.input` (`#FBFAF6`) with ink text. Remove the "stays ink-on-cream regardless of mode" comment.
7. **Session footer** (`SessionStatusLine`, `SessionPanel.tsx:174`) rebuilt on theme tokens. Today it hard-codes cream text (`ogs.creamInk`, `LINE_MUTED rgba(242,238,229,.6)`) on `rgba(255,255,255,.06)` plus `ContextBar onDark`, unreadable on a light terminal. Content unchanged: state, tool detail, channel · model, context bar, cost, and the Abrir sessão / Retomar / Tentar novamente action. Height 24 → 28px. The context bar track/"ok" color come from tokens instead of `onDark`. Cursor keeps its "~" estimated cost and no context bar.
8. **Content of every tab kind uses the same tokens** (paper surface, hairline borders, add/remove diff backgrounds in tokens), so a tab's body matches the frame in both themes. Browser pages keep their own colors.

## Non-goals

Split panes, dragging a tab out, restoring MCP tabs, new shortcuts, changing the "＋" menu (the user removed that idea; it stays as today), reopen-closed for non-file tabs.

## Anti-goals

No regressions in pin, reorder, close-many, drop-files, restore, unsaved guard (existing tests keep passing). No "Untitled" or never-ending "Iniciando…" labels. No hard-coded hex in components.

## Constraints

- Tokens live in `src/renderer/tokens.ts` / `theme.ts`.
- `prefers-reduced-motion` respected.
- Lint + typecheck + tests green; e2e tests read well to a human watching and drive the focused session (CLAUDE.local.md).
- CLI output (Claude / Cursor) chooses its own colors; contrast in a light xterm is a risk that cannot be settled without a real `claude` session.

## Approaches

- A. Shrinking tabs only — simple, degrades to dots at 20+ tabs, no search.
- B. Slim strip + switcher only — scales, hides most tabs behind a click.
- **C (chosen by the user): shrinking + icon-only fixed tabs + switcher** — one design for 4 and 40 tabs; more parts than A.

## Design

- Split `WorkbenchCanvas.tsx` (405 lines): `WorkbenchTabStrip` (layout, shrink, drag), `WorkbenchTab` (one tab: glyph, tone, state dot, close, dirty), `WorkbenchTabSwitcher` (popover, search, groups). The canvas keeps content and breadcrumb rendering.
- Shrink rule: inactive `flex: 1 1 0` with a glyph-only `min-width` and a max of ~150px; active `flex: 0 0 auto`. Below the label threshold show glyph + state dot (tooltip carries the label). Active tab is scrolled into view as today.
- Switcher: reuses the `tabs` / `onSelect` data of "Todas as abas"; adds `sessionState`, grouping by kind, a label filter, keyboard navigation (↑↓ ↵ esc). The needs-input badge on the trigger opens it pre-filtered.
- Theme: new surface tokens for strip, active tab, session footer and terminal (both modes); tab tone tokens; add/remove diff tokens.
- Footer and terminal read the tokens through the theme (no `onDark` flags).

## My calls (correct me)

- Switcher shortcut is not ⌘P (taken by quick-open); it opens from its button, and a shortcut is picked from the unused ones later.
- Footer height 28px and the tone assignments in goal 4 are proposals from the mockups.
- Tab-kind content in the gallery was sketched from component names, not from the running app.

## Open items

- ⌃Tab (recent tabs) and ⌘1–9: not decided; stay out until the user says so.
- Whether Cursor/Claude CLI output stays readable on the light terminal.

## Left to the builder

Exact spacing, thresholds, token names and values (all ANSI colors), switcher keyboard details, test updates, where `terminalTheme` lives.

## Verification

`npm run lint`, `npm run typecheck`, `npm test`, `npm run build` + e2e for tabs (select, close, overflow with 12+ tabs, switcher, scope switch) and sessions (footer states, theme switch while a session runs). Not verifiable without the running app, reported as such: visual look in light/dark, fonts/glyphs, contrast in a real `claude` session.
