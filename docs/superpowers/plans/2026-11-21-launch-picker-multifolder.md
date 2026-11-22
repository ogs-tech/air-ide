# Launch picker for multi-folder workspaces Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** One searchable picker to find and run any `launch.json` configuration of any folder of the open workspace, showing what is already running.

**Architecture:** Renderer-only. A pure module (`lib/launch-picker.ts`) owns entry shape, ranking and recents; a hook (`useAllLaunchConfigs`) fans `launchConfig.list` out per folder; a self-contained `LaunchPicker` dialog composes them with `useTerminals`/`useRunLaunchConfig`. `WorkspaceScreen` owns the single picker instance; `TerminalsSection` (＋▾ menu) and `WorkspaceOverview` (Launch card) only ask it to open.

**Tech Stack:** React, MUI Dialog, @tanstack/react-query (`useQueries`), Vitest + Testing Library (jsdom), Playwright e2e. No new dependency.

**Spec:** `docs/superpowers/specs/2026-11-21-launch-picker-multifolder-design.md`

## Global Constraints

- Renderer only; no main-process or IPC change; no new dependency (MUI Dialog + existing `Icon`/`Typography`).
- At Início (`launchConfig.list` → `null`) the entry point is hidden, as today.
- Folder routing goes through `useFolderRouting()`; single-folder workspace shows no folder tag.
- Strict TS, `.js` import extensions, pt-BR UI copy, English code/comments/test names.
- Recents: `localStorage` key `launch-recents:<workspaceId>`, max 8 `{ folder, name }`, every read/write in try/catch.
- Footer toggle copy: `Mostrar não suportadas (N)`; malformed line: `api: launch.json inválido — <error>`; menu item: `Executar configuração…`; overview link: `Ver todas (N)…`; running badge: `● rodando`.
- Overview card shows at most 5 entries and still hides when there are no configs.
- Do not touch how `TerminalsSection` rows list/stop/restart terminals.
- Lint + typecheck + tests green; no commits per step — the user makes the single commit at the end (Step "Commit" is omitted by user rule).

## Review Focus

1. **Same config name in two folders** (`dev` in `api` and `web`): running state and ⏎-focus must match on `folder` + `name`, never `name` alone. Test in Task 1 (`isRunning`) and Task 2.
2. **`localStorage` throws / holds garbage** (private window, corrupt JSON, wrong shape): picker still works, recents ignored. Test in Task 1.
3. **A recent that no longer exists** (config renamed/deleted, folder removed): silently skipped, never rendered as a ghost row. Test in Task 1.
4. **Folder whose `launch.json` is malformed while others are fine**, and **all folders empty/erroring**: error lines show, other folders list, empty state text instead of a blank dialog. Test in Task 2.
5. **Terminal exited for a config** (`status: 'exited'`): not "rodando"; ⏎ starts a fresh run instead of focusing the dead tab. Test in Task 2.

---

### Task 1: Pure launch-picker logic and `useAllLaunchConfigs`

**Files:**
- Create: `src/renderer/lib/launch-picker.ts`
- Modify: `src/renderer/hooks/use-launch-configs.ts`
- Test: `tests/renderer/lib/launch-picker.test.ts` (create), `tests/renderer/hooks/use-launch-configs.test.tsx` (append)

**Interfaces:**
- Produces (`lib/launch-picker.ts`):
  - `interface LaunchEntry { folder: string; folderLabel: string; config: LaunchConfig }`
  - `interface LaunchRecent { folder: string; name: string }`
  - `isRunning(entry: LaunchEntry, terminals: readonly TerminalSnapshot[]): TerminalSnapshot | undefined` — the running `kind: 'launch'` terminal with the same `name` and `folder`, else `undefined`.
  - `rankLaunchEntries(entries: readonly LaunchEntry[], query: string, terminals: readonly TerminalSnapshot[], recents: readonly LaunchRecent[]): LaunchEntry[]` — empty query: running → recents (recents order) → rest (input order); non-empty: drop non-matches, rank name-prefix > name-substring > folderLabel-substring (case-insensitive), ties broken by recents then input order.
  - `readLaunchRecents(workspaceId: string): LaunchRecent[]` / `pushLaunchRecent(workspaceId: string, recent: LaunchRecent): void` — try/catch, validates shape, dedupes, newest first, max 8.
  - `dropStaleRecents(recents, entries): LaunchRecent[]`.
- Produces (`use-launch-configs.ts`): `useAllLaunchConfigs(enabled?: boolean): { entries: LaunchEntry[]; errors: Array<{ folder: string; folderLabel: string; error: string }>; isLoading: boolean; active: boolean }` (`active` = at least one folder answered non-`null`, i.e. not Início). Single-folder: calls `launchConfig.list` without `folder` and with query key `launchConfigsQueryKey` (unchanged key); multi-folder: one query per folder with key `[...launchConfigsQueryKey, folder]`, params `{ folder }`. `folderLabel` = `routing.aliases[folder]` (multi) or `''` (single). A `null` result (Início) contributes nothing.

- [ ] **Step 1: Write failing tests** in `tests/renderer/lib/launch-picker.test.ts`:
  - `isRunning` matches `folder`+`name`+`status:'running'`+`kind:'launch'`; does not match same name in another folder, an exited terminal, or a `shell` terminal named the same.
  - `rankLaunchEntries('')` orders `[running, recent, rest]`; `rankLaunchEntries('de')` puts `dev` (prefix) before `my-dev` (substring) before an entry matched only by folder label `design`; recents break ties; non-matches dropped.
  - `readLaunchRecents` returns `[]` when `localStorage.getItem` throws, when JSON is corrupt, and when items have the wrong shape (keeps the valid ones); `pushLaunchRecent` dedupes, puts newest first, caps at 8, and does not throw when `setItem` throws.
  - `dropStaleRecents` removes a recent whose `folder`+`name` is absent from entries.
  Append to `use-launch-configs.test.tsx`: `useAllLaunchConfigs` with a single-folder workspace calls `launchConfig.list` with no params and returns one entry with `folderLabel: ''`; with a two-folder workspace (mock `workspace.getActive`/whatever `useActiveWorkspace` calls — copy the setup from `tests/renderer/hooks/use-folder-routing.test.ts`) calls `launchConfig.list` twice with `{ folder: '/r/api' }` / `{ folder: '/r/web' }`, flattens both, and reports `errors` for the folder answering `{ error: 'boom', configs: [] }` while still returning the other folder's entries; `active` is `false` when every folder answers `null`.
- [ ] **Step 2:** Run `npx vitest run tests/renderer/lib/launch-picker.test.ts tests/renderer/hooks/use-launch-configs.test.tsx` — Expected: FAIL (modules/exports missing).
- [ ] **Step 3:** Implement `lib/launch-picker.ts` as specified above (pure; no React).
- [ ] **Step 4:** Implement `useAllLaunchConfigs` with `useQueries` over `useFolderRouting().folders`; derive `entries`/`errors` in render (memoize on the query `data` array identity is not required).
- [ ] **Step 5:** Re-run the command from Step 2 — Expected: PASS.

---

### Task 2: `LaunchPicker` dialog

**Files:**
- Create: `src/renderer/components/workspace/LaunchPicker.tsx`
- Test: `tests/renderer/components/workspace/LaunchPicker.test.tsx` (create)

**Interfaces:**
- Consumes: Task 1 (`LaunchEntry`, `rankLaunchEntries`, `isRunning`, `readLaunchRecents`, `pushLaunchRecent`, `dropStaleRecents`, `useAllLaunchConfigs`), `useTerminals`, `useRunLaunchConfig`, `useFolderRouting`, `useActiveWorkspace` (for `workspaceId`).
- Produces: `LaunchPicker(props: { open: boolean; onClose: () => void; onOpenTerminal: (terminal: TerminalSnapshot) => void; onEditLaunchJson: (folder: string | undefined) => void; onError: (message: string) => void }): React.ReactElement`.
  Test ids: `launch-picker` (dialog), `launch-picker-search`, `launch-picker-row-<folderAlias-or-root>-<name>`, `launch-picker-running-…` badge inside a row, `launch-picker-toggle-unsupported`, `launch-picker-error-<alias>`, `launch-picker-edit`, `launch-picker-empty`.

Behavior (from the spec): autofocused search; rows show ▶, name, folder tag only when `routing.multi`, `● rodando` when `isRunning`; ↑↓ moves highlight (first row highlighted on open and on query change), ⏎ runs highlighted — if running, `onOpenTerminal(thatTerminal)` and no `launchConfig.run` call; ⇧⏎ always runs a new one; Esc/`onClose` closes. A run passes `{ configName, folder }` only when `routing.multi`, calls `pushLaunchRecent`, then `onOpenTerminal(terminal)` and `onClose()`; failure → `onError(message)` and the dialog stays open. Unsupported entries hidden; toggle reveals them as disabled rows with the existing reason tooltip (`Tipo '<type>'/request '<request>' não suportado — só node/launch pode ser executado`); ⏎ on them does nothing. Each folder `error` renders one line `<label>: launch.json inválido — <error>` above the list (single-folder: no label prefix). `Editar launch.json` calls `onEditLaunchJson(highlighted?.folder)` (`undefined` when the list is empty). Nothing to show → `launch-picker-empty` text.

- [ ] **Step 1: Write failing tests** (render with `renderWithShell`, answers keyed by method like `TerminalsSection.test.tsx`; 2-folder workspace fixture with `dev` in both folders and `web` unsupported in one):
  - lists configs of both folders with folder tags; single-folder shows no tag.
  - typing `api` filters by folder label; typing `de` ranks prefix first.
  - running badge appears only on the `api` `dev` row when the running terminal's `folder` is api's (Review Focus 1).
  - ⏎ on a running row calls `onOpenTerminal` with the existing terminal and never calls `launchConfig.run`; ⇧⏎ calls `launchConfig.run` with `{ configName: 'dev', folder: '/r/api' }`.
  - exited terminal for the config → no badge, ⏎ calls `launchConfig.run` (Review Focus 5).
  - unsupported hidden until `launch-picker-toggle-unsupported` (label `Mostrar não suportadas (1)`) is clicked; then row has `aria-disabled="true"`.
  - folder with `error: 'unexpected token'` shows `web: launch.json inválido — unexpected token` while the other folder's rows still render; all folders empty → `launch-picker-empty` (Review Focus 4).
  - successful run writes `launch-recents:<id>` and, on reopening with an empty query, that entry is listed first among non-running ones.
  - failed run → `onError` called, `onClose` not called.
  - `Editar launch.json` passes the highlighted row's folder.
- [ ] **Step 2:** Run `npx vitest run tests/renderer/components/workspace/LaunchPicker.test.tsx` — Expected: FAIL (module missing).
- [ ] **Step 3:** Implement `LaunchPicker.tsx` with MUI `Dialog` + `TextField` (`autoFocus`), highlight index in local state, key handling on the search input's `onKeyDown`; styling from theme tokens only (mirror `FolderPickerDialog.tsx` for dialog chrome and `TerminalsSection.tsx` for mono name / small tag typography).
- [ ] **Step 4:** Re-run the command from Step 2 — Expected: PASS.

---

### Task 3: Wire entry points — ＋▾ menu, `WorkspaceScreen`, folder-aware `launch.json`

**Files:**
- Modify: `src/renderer/components/workspace/TerminalsSection.tsx` (props at `:21-30`, menu at `:218-251`)
- Modify: `src/renderer/screens/workspace/WorkspaceScreen.tsx` (`onEditLaunchJson` at `:375`, `<TerminalsSection>` at `:1406-1414`, Overview render site, one `<LaunchPicker>` instance)
- Test: `tests/renderer/components/workspace/TerminalsSection.test.tsx` (modify the menu test at `:104`), `tests/renderer/screens/workspace/WorkspaceScreen.test.tsx` (append)

**Interfaces:**
- Consumes: `LaunchPicker` (Task 2).
- Produces: `TerminalsSectionProps` loses nothing but gains `onOpenLaunchPicker: () => void`, and `onEditLaunchJson: (folder?: string) => void` (the menu item calls `onEditLaunchJson()` with no folder = primary). `WorkspaceScreen` holds `const [launchPickerOpen, setLaunchPickerOpen] = useState(false)` and passes `onOpenLaunchPicker={() => setLaunchPickerOpen(true)}` to both `TerminalsSection` and (Task 4) `WorkspaceOverview`. `onEditLaunchJson = (folder?: string) => openFileTab(folderRouting.join(folder, '.vscode/launch.json'))`.

- [ ] **Step 1: Write failing tests:**
  - `TerminalsSection`: replace the old "launch configs in menu" assertions — the ＋▾ menu has `terminals-menu-open-launch-picker` (text `Executar configuração…`) when `launchConfig.list` returns configs, **and** when it returns an empty `configs: []`; it has no `terminals-menu-launch-<name>` items; clicking it calls `onOpenLaunchPicker`; at `launchConfig.list → null` the item is absent (Início/no data). `terminals-menu-edit-launch` still calls `onEditLaunchJson`.
  - `WorkspaceScreen`: in a 2-folder workspace, choosing `Executar configuração…` opens `launch-picker`; picking `Editar launch.json` with the `web` row highlighted opens a file tab whose path is `web/.vscode/launch.json`; in a single-folder workspace the path stays `.vscode/launch.json`.
- [ ] **Step 2:** Run both test files — Expected: FAIL.
- [ ] **Step 3:** In `TerminalsSection`, drop `useLaunchConfigs`/`useRunLaunchConfig`/the per-config `MenuItem` map (and the now-unused `Play`/`Tooltip` imports if nothing else uses them); show the single `Executar configuração…` item whenever `useAllLaunchConfigs().active` is true (even with zero configs — one path, fewer states).
- [ ] **Step 4:** In `WorkspaceScreen`, add the state, render one `<LaunchPicker open={launchPickerOpen} onClose=… onOpenTerminal={openTerminalTab} onEditLaunchJson={onEditLaunchJson} onError={(message) => setToast({ variant: 'error', message })} />` only when `activeWorkspace` is set, and update `onEditLaunchJson`.
- [ ] **Step 5:** Run both test files plus `tests/renderer/hooks/use-launch-configs.test.tsx` — Expected: PASS.

---

### Task 4: Overview Launch card capped at 5

**Files:**
- Modify: `src/renderer/components/workspace/overview/WorkspaceOverview.tsx` (`:55-61`, `:148-179`), its props and its render site in `WorkspaceScreen.tsx`
- Test: `tests/renderer/components/workspace/overview.test.tsx` (modify `:173-195`)

**Interfaces:**
- Consumes: `useAllLaunchConfigs`, `rankLaunchEntries`, `readLaunchRecents`, `dropStaleRecents`, `pushLaunchRecent`, `useTerminals`.
- Produces: `WorkspaceOverviewProps` gains `onOpenLaunchPicker: () => void`.

- [ ] **Step 1: Write failing tests:** with 7 supported configs the card renders exactly 5 `overview-launch-*` rows plus `overview-launch-see-all` with text `Ver todas (7)…` that calls `onOpenLaunchPicker`; with ≤5 configs no `Ver todas` row; a running config and a recent one appear in the 5 even if they are last in file order; multi-folder rows show the folder tag, and the run button sends `{ configName, folder }`; the existing single-folder run test keeps passing unchanged (`{ configName: 'dev' }`, no `folder`); card still hidden when no entries.
- [ ] **Step 2:** Run `npx vitest run tests/renderer/components/workspace/overview.test.tsx` — Expected: FAIL.
- [ ] **Step 3:** Replace `useLaunchConfigs` with `useAllLaunchConfigs`; order with `rankLaunchEntries(entries, '', terminals, dropStaleRecents(readLaunchRecents(workspace.id), entries)).slice(0, 5)`; run via `useRunLaunchConfig` with the multi-folder `folder` rule and `pushLaunchRecent` on success; `testId` keeps `overview-launch-${config.name}` for single-folder and appends the folder alias in multi-folder to keep ids unique.
- [ ] **Step 4:** Pass `onOpenLaunchPicker` from `WorkspaceScreen`. Re-run Step 2's command and `tests/renderer/screens/workspace/WorkspaceScreen.test.tsx` — Expected: PASS.

---

### Task 5: E2E, docs, full gate

**Files:**
- Modify: `e2e/fixtures/app.ts` (`seedWorkspaceRegistry`: optional `extraFolders?: string[]` on each workspace entry; backwards compatible)
- Create: `e2e/product/workspaces/launch-picker.spec.ts`
- Modify: `docs/technical/architecture/reference/ipc-contract.md` (`launchConfig.run` row at `:326`: params `{ configName: string; folder?: string }`; note that `list`/`run` accept `folder` for multi-folder workspaces, replacing the "reached by opening that folder as its own workspace" sentence at `:318`)
- Modify: `docs/product/…` only if a doc already describes launching configs (grep `launch.json` under `docs/product`; skip if none)

**Interfaces:** Consumes the test ids from Tasks 2–4.

- [ ] **Step 1: Write the e2e spec** (human-watchable per CLAUDE.local.md): seed a workspace with two folders, each with a distinct `.vscode/launch.json` (node/launch configs that run a short-lived `node -e` program; one folder also has a `chrome` entry); open ＋▾ → `Executar configuração…`; assert both folders' configs with tags; type to filter; run one from the picker and see its terminal tab become the active tab; reopen the picker and assert `● rodando` on that row only (not the same-named config of the other folder); ⏎ on it focuses the existing tab (terminal count unchanged); `Mostrar não suportadas (1)` reveals the chrome entry disabled; switch to Início and back → the menu entry is absent at Início and the picker works again after returning.
- [ ] **Step 2:** `npm run build && npx playwright test e2e/product/workspaces/launch-picker.spec.ts` (use the project's existing e2e command from `package.json`; `pkill -f ai-companion-e2e-userdata` first if a stale Electron blocks launch) — Expected: PASS.
- [ ] **Step 3:** Update `ipc-contract.md` as listed.
- [ ] **Step 4:** Gate: `npm run lint && npm run typecheck && npm test` — Expected: all green. Report plainly what was **not** verified: visual look, dark theme, keyboard feel in the real app.
