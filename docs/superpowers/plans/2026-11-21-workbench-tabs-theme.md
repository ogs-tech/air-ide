# Workbench Tabs + Light/Dark Refinement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A Workbench tab strip that scales from 4 to 40 tabs and terminals + session footer that follow the app's light/dark theme.

**Architecture:** New theme tokens (strip, active tab, footer, diff, tab tones) feed three focused components split out of `WorkbenchCanvas` (`WorkbenchTabStrip`, `WorkbenchTabItem`, `WorkbenchTabSwitcher`). One shared `terminalTheme(mode)` replaces both hard-coded xterm themes and is applied live via `terminal.options.theme`. Session tabs get a truthful label helper and a persistent state dot.

**Tech Stack:** React + MUI/Emotion, `@xterm/xterm`, lucide-react, Vitest (jsdom project), Playwright e2e.

**Spec:** `docs/superpowers/specs/2026-11-21-workbench-tabs-theme-design.md`

## Global Constraints

- **No commits.** The user makes one commit at the end (CLAUDE.local.md). Each task ends with "leave the tree for review", not `git commit`.
- Lint + typecheck + the task's tests green at the end of every task: `npm run lint`, `npm run typecheck`, `npx vitest run <files>`.
- Tokens live in `src/renderer/tokens.ts` / `theme.ts`; **no hard-coded hex/rgba in components** (anti-goal). `ChannelMark`'s brand orange is the one existing exception and is reused, not copied.
- `prefers-reduced-motion` respected: any new animation sits inside `@media (prefers-reduced-motion: no-preference)`.
- No "Untitled" and no never-ending "Iniciando…" in any tab label.
- Existing behavior keeps passing: pin, reorder, close-many, drop-files, restore, unsaved guard. Existing test ids stay: `workbench-tab-<id>`, `workbench-tab-close-<id>`, `workbench-tab-dirty-<id>`, `workbench-tab-state-<id>`, `workbench-all-tabs`, `workbench-all-tabs-<id>`, `workbench-pinned-divider`, `workbench-new*`.
- Footer height **28px** (was 24). Active/inactive tab rule: inactive `flex: 1 1 0`, max ~150px; active `flex: 0 0 auto`.
- Tone map (spec goal 4): session = Claude accent / Cursor blue / LM Studio green; file = blue; git diff = green; browser = blue; skill/agent/instruction = accent; MCP = green; preview = blue; terminal / history / config = neutral. Config and Visão geral stay icon-only fixed tabs.
- Imports use `.js` extensions; `exactOptionalPropertyTypes` is on.
- Non-goals: split panes, tab drag-out, MCP tab restore, new shortcuts (no ⌃Tab, no ⌘1–9, no switcher shortcut), changing the "＋" menu.

## Review Focus

1. 40+ tabs, including several with identical labels (e.g. many `INSTRUCTIONS`): strip never overflows horizontally, the active tab is still fully labelled, switcher still tells them apart (breadcrumb as secondary text). → Task 6 e2e, Task 7 test.
2. A session whose title is empty, `Untitled`, or the generic default: tab and switcher show "Nova sessão", never "Untitled". → Task 4 test.
3. Theme flipped while a session/terminal runs: same xterm instance, no remount, scrollback intact. → Task 2 tests.
4. Needs-input session tab scrolled/shrunk out of sight: amber count on the switcher button, opens pre-filtered. → Task 7 test.
5. Cursor session (no context bar, "~" cost) and a session with no metrics yet: footer renders without gaps at 28px in both themes. → Task 3 test.

---

### Task 1: Theme tokens (surfaces, tones, diff)

**Files:**
- Modify: `src/renderer/tokens.ts`, `src/renderer/theme.ts`
- Create: `src/renderer/lib/tab-tone.ts`
- Test: `tests/renderer/lib/tab-tone.test.ts`, `tests/renderer/theme.test.ts` (extend if it exists, else create)

**Interfaces:**
- Produces (tokens.ts): `workbench = { light: {...}, dark: {...} }` with keys `strip` (darker than `surfaces.paper`), `tabActive`, `tabHover`, `footer`, `footerMuted` (text), `diffAdd`, `diffRemove`. Exposed as `theme.ogs.workbench` (extend the `Theme['ogs']` declaration in `theme.ts`).
- Produces (tab-tone.ts): `type TabKind = 'overview' | 'session' | 'file' | 'git-diff' | 'browser' | 'skill' | 'agent' | 'instruction' | 'mcp' | 'preview' | 'terminal' | 'history' | 'config'`; `tabToneColor(theme: Theme, kind: TabKind, channel?: ChannelId): string` — the top-rule / glyph color for the kind.

- [ ] **Step 1: Write failing tests.** `tab-tone.test.ts`: for `createAppTheme('light')` and `('dark')`, assert `tabToneColor(theme,'file')` equals `theme.palette.info.main`; `'git-diff'` and `'mcp'` equal `palette.success.main`; `'session'` with `'cursor'` equals `palette.info.main`, with `'lmstudio'` equals `palette.success.main`, with `'claude'` equals `'#D97757'` (ChannelMark's orange — export that constant from `ChannelMark.tsx` as `CLAUDE_BRAND_COLOR` and import it); `'terminal'`, `'history'`, `'config'`, `'overview'` equal `theme.palette.text.secondary`; `'skill'|'agent'|'instruction'` equal `theme.palette.primary.main`. `theme.test.ts`: both modes expose `theme.ogs.workbench.strip`, and in light mode `strip !== surfaces.light.paper`.
- [ ] **Step 2: Run** `npx vitest run tests/renderer/lib/tab-tone.test.ts tests/renderer/theme.test.ts` → FAIL (module/key missing).
- [ ] **Step 3: Implement** the `workbench` token block (values are the builder's call; strip must read darker than the content in both modes, footer must sit on `surfaces.*.input` family so it matches the light terminal), wire into `createAppTheme`, add `CLAUDE_BRAND_COLOR` export, implement `tabToneColor`.
- [ ] **Step 4: Run** the two test files → PASS; then `npm run lint && npm run typecheck`.
- [ ] **Step 5:** Leave tree for review.

---

### Task 2: `terminalTheme(mode)` and live theme in both terminals

**Files:**
- Create: `src/renderer/lib/terminal-theme.ts`
- Modify: `src/renderer/components/SessionPanel.tsx` (const at `:89-93`, `new Terminal` at `:337`, wrapper `bgcolor` at `:597`), `src/renderer/components/workspace/TerminalPanel.tsx` (const at `:12`, `new Terminal` at `:41`, wrapper at `:127`)
- Test: `tests/renderer/lib/terminal-theme.test.ts`, `tests/renderer/components/workspace/TerminalPanel.test.tsx`, `tests/renderer/components/session-panel.test.tsx`

**Interfaces:**
- Produces: `terminalTheme(mode: PaletteMode): ITheme` (from `@xterm/xterm`) with `background, foreground, cursor, cursorAccent, selectionBackground` and all 16 ANSI keys (`black … brightWhite`). Light background is `surfaces.light.input` (`#FBFAF6`) with ink foreground; dark keeps the ink background.
- Produces: `contrastRatio(fg: string, bg: string): number` exported from the same file (WCAG relative-luminance formula) so tests and future checks share it.

- [ ] **Step 1: Failing tests.** `terminal-theme.test.ts`, for both modes: `contrastRatio(foreground, background) >= 7`; every ANSI color except `black`/`brightBlack` in light and `white`/`brightWhite` in dark has `contrastRatio >= 3` against the background; `black`/`white` (the one that equals the background tone) still `>= 3` against the *opposite*… simpler: assert every one of the 16 colors `>= 3` — choose values so it holds; `selectionBackground` differs from `background`. `TerminalPanel.test.tsx`: extend the xterm mock with `options: {}`; render under the dark theme, assert `instances[0].options.theme.background === terminalTheme('dark').background`; rerender under the light theme and assert `xterm.instances.length === 1`, `dispose` not called, and `options.theme.background === terminalTheme('light').background`. Same pair in `session-panel.test.tsx` using that file's existing xterm mock.
- [ ] **Step 2: Run** the three files → FAIL.
- [ ] **Step 3: Implement** `terminalTheme` and `contrastRatio`. In both panels read `useTheme().palette.mode`; pass `terminalTheme(mode)` to `new Terminal` (keep the creation effect's deps free of `mode` so a flip never remounts — read mode through a ref) and add a separate `useEffect([mode])` that assigns `terminalRef.current.options.theme = terminalTheme(mode)`. Replace both wrapper `bgcolor: ogs.ink` with `terminalTheme(mode).background`. Delete the two `TERMINAL_XTERM_THEME` consts and the "stays ink-on-cream regardless of mode" comment; drop now-unused `ogs`/`colorRoles` imports.
- [ ] **Step 4: Run** the three files → PASS; `npm run lint && npm run typecheck`.
- [ ] **Step 5:** Leave tree for review.

---

### Task 3: Session footer on theme tokens

**Files:**
- Modify: `src/renderer/components/SessionPanel.tsx` (`STATUS_LINE_HEIGHT`/`LINE_MUTED`/`SessionStatusLine` at `:168-245`), `src/renderer/components/ContextBar.tsx`
- Test: `tests/renderer/components/session-status-ui.test.tsx`, `tests/renderer/components/ContextBar.test.tsx` (create if absent)

**Interfaces:**
- Consumes: `theme.ogs.workbench.footer`, `theme.ogs.workbench.footerMuted` (Task 1).
- Produces: `ContextBar` loses the `onDark` prop (signature becomes `{ metrics, estimated?, testId? }`); track = `action.hover`, `ok` color = `text.disabled` always.

- [ ] **Step 1: Failing tests.** `session-status-line` has `height: 28px`; its computed color is not `rgb(242, 238, 229)` (cream) in the light theme; no element inside it uses an inline `rgba(255, 255, 255, …)` background. Rendered under both themes with: a Claude session with metrics (model, cost, context bar), a Cursor session (cost text starts with `~`, no `session-context`), a session with no metrics (no model/cost/context nodes, still 28px). `ContextBar` test: with `level === 'ok'` the filled bar's background equals the theme's `text.disabled`.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement.** Set `STATUS_LINE_HEIGHT = 28`; footer `bgcolor`/`color` from `theme.ogs.workbench.footer`/`text.primary`; muted text from `footerMuted`; delete `LINE_MUTED`; remove `onDark` from `ContextBar` and its call site. Content and the Abrir sessão / Retomar / Tentar novamente action are unchanged.
- [ ] **Step 4: Run** the two files plus `tests/renderer/components/session-panel.test.tsx` → PASS; lint + typecheck.
- [ ] **Step 5:** Leave tree for review.

---

### Task 4: Truthful session tab label

**Files:**
- Create: `src/renderer/lib/session-tab-label.ts`
- Modify: `src/renderer/screens/workspace/WorkspaceScreen.tsx:1213-1222` (the `label:` expression of the `session` tab)
- Test: `tests/renderer/lib/session-tab-label.test.ts`

**Interfaces:**
- Consumes: `UNTITLED_LABEL` from `src/renderer/lib/session-attention.ts:124`.
- Produces: `sessionTabLabel(candidates: readonly (string | undefined)[]): string` — first candidate that is non-empty after trim and `!== UNTITLED_LABEL`; else `'Nova sessão'`.

- [ ] **Step 1: Failing test.** `sessionTabLabel(['Fix login', 'Untitled'])` → `'Fix login'`; `([undefined, 'Untitled', ''])` → `'Nova sessão'`; `(['  ', 'Refactor'])` → `'Refactor'`; `([])` → `'Nova sessão'`.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement** and replace the `??` chain in `WorkspaceScreen` with `sessionTabLabel([conversationTitle, tabSession?.label, tab.label])` (conversation title only for workspace/personal anchors, as today).
- [ ] **Step 4: Run** the new test + `tests/renderer/screens` workspace tests that mention session tabs → PASS; lint + typecheck.
- [ ] **Step 5:** Leave tree for review.

---

### Task 5: Split `WorkbenchCanvas` (pure extraction, no behavior change)

**Files:**
- Create: `src/renderer/components/workspace/workbench-tab.ts` (the `WorkbenchTab` interface + new `kind: TabKind`), `WorkbenchTabItem.tsx` (one tab: lines `:146-286` of today's canvas), `WorkbenchTabStrip.tsx` (strip, scroll-into-view, overflow measure, trailing buttons, drag state)
- Modify: `src/renderer/components/workspace/WorkbenchCanvas.tsx` (keeps content, breadcrumb, drop zone, menus; re-exports `WorkbenchTab` type), `src/renderer/screens/workspace/WorkspaceScreen.tsx` (every tab builder sets `kind`; kinds at the `kind: '…'` branches listed around `:240-1100`, `entity` tabs map to their `tab.kind` skill/agent/instruction, `overview` for `overviewTab`)
- Test: existing `tests/renderer/components/workspace/WorkbenchCanvas.test.tsx` and `OpenEditorsSection.test.tsx` must pass **unchanged** except for adding `kind` to fixtures.

**Interfaces:**
- Produces: `WorkbenchTab.kind: TabKind` (required); `WorkbenchTabItem` props `{ tab, active, onSelect, onContextMenu, drag handlers }`; `WorkbenchTabStrip` props = the strip-relevant subset of today's `WorkbenchCanvasProps` plus `onOpenSwitcher(anchor: HTMLElement, filter?: 'needs-input')`.

- [ ] **Step 1:** Add `kind` to the fixtures in the existing tests (typecheck fails until the type exists).
- [ ] **Step 2: Run** `npx vitest run tests/renderer/components/workspace/WorkbenchCanvas.test.tsx` → baseline PASS before moving code.
- [ ] **Step 3: Move** the markup into the three files verbatim; `WorkbenchCanvas` composes them. No style or behavior change in this task.
- [ ] **Step 4: Run** the same tests + `npm run typecheck` → PASS (typecheck proves every `WorkspaceScreen` builder sets `kind`).
- [ ] **Step 5:** Leave tree for review.

---

### Task 6: Tab visuals, shrink rule, tone and state dot

**Files:**
- Modify: `WorkbenchTabItem.tsx`, `WorkbenchTabStrip.tsx`
- Test: `tests/renderer/components/workspace/WorkbenchTabItem.test.tsx` (create), `e2e/product/sessions/workbench.spec.ts` (extend)

**Interfaces:**
- Consumes: `tabToneColor` (Task 1), `theme.ogs.workbench.{strip,tabActive,tabHover}`, `WorkbenchTab.kind`.
- Produces: tab root exposes `data-active`, `data-kind`; the persistent state dot is `data-testid="workbench-tab-state-<id>"` (existing id, now always visible for sessions, also when the tab is tight).

- [ ] **Step 1: Failing unit tests** (`WorkbenchTabItem.test.tsx`): active tab has `data-active="true"`, a `border-top` of 2px in `tabToneColor` for its kind, and `flex: 0 0 auto`; inactive has `flex: 1 1 0` and `max-width: 150px`; every session state (`needs-input`, `working`, `idle`, `exited`) renders `workbench-tab-state-<id>`; `iconOnly` tab renders no label text but keeps `aria-label`; a session tab with label `Nova sessão` never renders the text `Untitled`; the `needs-input` attention ring is declared only inside `prefers-reduced-motion: no-preference`; dirty dot and close button still swap on hover (move the existing assertions from `WorkbenchCanvas.test.tsx` if present).
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement.** Strip `bgcolor = workbench.strip`; active tab = `workbench.tabActive` surface, hairline border, `borderTop: 2px solid <tone>`, `borderRadius: radius.xs radius.xs 0 0`, bottom edge overlapping the strip border so it joins the content; glyph tinted with the tone. Label hides via a container query (`container-type: inline-size` on the tab, `@container (max-width: <threshold>px)` hides the label and close, keeping glyph + state dot); tooltip carries the label whenever the label can be hidden. Keep scroll-into-view of the active tab.
- [ ] **Step 4: E2E** (`npm run build` first; `pkill -f ai-companion-e2e-userdata` if a stale Electron blocks launch): open 12, then 40 tabs (files, one per name, plus ≥3 with identical labels); assert `workbench-tabs` `scrollWidth <= clientWidth + 1`; the active tab's label is not truncated (`scrollWidth <= clientWidth`); each session tab shows its state dot; the driven session is the selected tab and has a real title (send a first prompt so no row says "Untitled" — CLAUDE.local.md). Use the realistic CLI stubs in `e2e/fixtures/cli-stubs.ts`.
- [ ] **Step 5: Run** `npx vitest run tests/renderer/components/workspace` and the e2e spec → PASS; lint + typecheck.
- [ ] **Step 6:** Leave tree for review.

---

### Task 7: Tab switcher

**Files:**
- Create: `src/renderer/components/workspace/WorkbenchTabSwitcher.tsx`
- Modify: `WorkbenchTabStrip.tsx` (button + badge), `WorkbenchCanvas.tsx` (mount, replace the "Todas as abas" `Menu` at `:321-336`)
- Test: `tests/renderer/components/workspace/WorkbenchTabSwitcher.test.tsx`, extend `WorkbenchCanvas.test.tsx` for the existing "Todas as abas" cases

**Interfaces:**
- Produces: `WorkbenchTabSwitcher({ tabs: readonly WorkbenchTab[], activeTabId: string | null, anchor: HTMLElement | null, initialFilter?: 'needs-input', onSelect: (id: string) => void, onClose: () => void })`. Groups ordered: Sessões, Arquivos, Git, Navegador, Customizações (skill/agent/instruction/mcp), Terminais, Outras (overview/config/history/preview). Row = tone glyph + label + state mark for sessions + `breadcrumb` as secondary text. Filter input matches label and breadcrumb, case-insensitive. Keys: ↑/↓ move, ↵ selects, Esc closes. Row test ids: `workbench-all-tabs-<id>` (unchanged); filter input `workbench-switcher-filter`.
- Strip button `workbench-all-tabs` shows when overflowing **or** any tab is `needs-input`; its amber badge `workbench-all-tabs-needs-input` shows the needs-input count whenever > 0, even when those tabs are visible; clicking with the badge opens the switcher with `initialFilter: 'needs-input'`.

- [ ] **Step 1: Failing tests.** Groups render in the order above and omit empty ones; typing `log` leaves only matching rows (and matches via breadcrumb); ↓ ↓ ↵ calls `onSelect` with the third row's id; Esc calls `onClose`; two tabs both labelled `INSTRUCTIONS` with different breadcrumbs are both listed with distinguishable secondary text; session rows show their state; `initialFilter: 'needs-input'` lists only needs-input sessions; canvas: with no overflow and no needs-input the button is absent; with one needs-input tab the button and badge `1` appear, clicking it opens the switcher pre-filtered; selecting a row calls `onSelect` and closes.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement** the switcher on MUI `Popover` + a plain list with a roving `aria-activedescendant` (no new dependency). Group mapping lives next to it as `switcherGroupOf(kind: TabKind): string`.
- [ ] **Step 4: E2E** (extend `workbench.spec.ts`): with 12+ tabs open, open the switcher, filter by a file name, select it → that tab becomes active and visible; scope switch Início ↔ workspace keeps the switcher consistent with the new tab set.
- [ ] **Step 5: Run** the switcher + canvas tests and the e2e spec → PASS; lint + typecheck.
- [ ] **Step 6:** Leave tree for review.

---

### Task 8: Tab bodies on the same tokens

**Files:**
- Modify: the git-diff view and any workbench tab body found by the audit in Step 1 (likely under `src/renderer/components/workspace/git/` and `EditorPanel.tsx`)
- Test: `tests/renderer/components/workspace/workbench-tokens.test.ts` (create)

**Interfaces:**
- Consumes: `theme.ogs.workbench.diffAdd` / `diffRemove` (Task 1).

- [ ] **Step 1: Audit.** `grep -rnE "rgba?\(|#[0-9a-fA-F]{3,8}\b" src/renderer/components/workspace src/renderer/components/SessionPanel.tsx src/renderer/components/ContextBar.tsx`. Intentional leftovers (search-highlight `#ffe066` in `EditorPanel`, browser pages) get a one-line comment; everything else moves to tokens. Diff add/remove backgrounds come from `diffAdd`/`diffRemove`.
- [ ] **Step 2: Failing test** `workbench-tokens.test.ts` (node-side file scan, in the jsdom project folder is fine): asserts the files touched by Tasks 2, 3, 5, 6, 7 contain no `#hex` or `rgba(` literals (allow-list: `EditorPanel.tsx` search highlight, `ChannelMark.tsx`).
- [ ] **Step 3: Run** → FAIL on whatever the audit finds; fix each by tokenizing.
- [ ] **Step 4: Run** the file + `npx vitest run tests/renderer` → PASS; lint + typecheck.
- [ ] **Step 5:** Leave tree for review.

---

### Task 9: Docs and final verification

**Files:**
- Modify: `docs/technical/architecture/reference/architecture.md` only if it names `WorkbenchCanvas` internals (grep first; skip if not)
- Test: e2e `e2e/product/sessions/lifecycle.spec.ts` (extend)

- [ ] **Step 1: E2E** — theme switch while a session runs: start a session (stub with realistic transcript, send a first prompt so it has a title), flip Settings theme light→dark→light; assert the same `session-terminal` element persists, `session-status-line` stays 28px, the session state stays `running`/`idle` (not restarted), and the tab remains the selected one.
- [ ] **Step 2: Full gate:** `npm run lint && npm run typecheck && npm test && npm run build`, then the e2e specs touched (`workbench.spec.ts`, `lifecycle.spec.ts`).
- [ ] **Step 3: Report what was not verified** (spec "Verification"): visual look in light/dark, fonts/glyphs, container-query threshold feel, and contrast of real `claude`/`cursor-agent` output on the light terminal.
- [ ] **Step 4:** Leave tree for review; the user makes the single commit.
