# Launch picker for multi-folder workspaces — design

Date: 2026-11-21 · Status: awaiting approval

## Intent and why

A workspace can hold several folders (`Workspace.rootPath` + `extraFolders`), each with its own
`.vscode/launch.json`. Today launch only sees the **primary** folder:

- `TerminalsSection.tsx` and `WorkspaceOverview.tsx` call `useLaunchConfigs()` with no `folder`, so
  `LaunchConfigService.list` resolves to `rootPath`.
- Running from the ＋▾ menu sends `routing.folders[0]`.
- Other folders' configurations are invisible, and a flat menu would not scale to dozens of entries anyway.

`launchConfig.list` and `launchConfig.run` already accept `folder`, so this is a renderer change.

Goal: from one place, find and run any configuration of any folder quickly, and see what is already running.

## Goals

- One **picker with search** over the configurations of **all** folders of the open workspace.
- Folder shown as a tag (`dev · api`), the same convention as skills/agents in multi-folder workspaces.
- "Rodando" indicator per configuration, so a second accidental run is avoided.
- Recents first, so the common case needs zero typing.
- Overview card stops dumping every entry.

## Non-goals

- `compounds`, `presentation.group/order`, `preLaunchTask`, non-node types (still listed only as unsupported).
- Favorites / pinning (recents cover the need; revisit if asked).
- Changing how terminals are listed, stopped or restarted (`TerminalsSection` rows stay as is).
- Any main-process or IPC change.

## Anti-goals

- A second list of running things competing with **Terminais**. The picker only *reads* terminal state.
- Per-folder pickers or a folder-selection step before the search.
- Confirmation dialogs.

## Constraints

- Renderer only; no new dependency (MUI Dialog + existing `Icon`/`Typography`).
- At Início (`launchConfig.list` → `null`) the entry point is hidden, as today.
- Folder routing goes through `useFolderRouting()`; in a single-folder workspace no tag is shown.
- Strict TS, `.js` import extensions, pt-BR UI copy.

## Approaches considered

| | Idea | Trade-off |
|---|---|---|
| A | Existing ＋▾ menu grouped by folder | Smallest change; long scroll at 25+ items, no search |
| **B** | Searchable picker over all folders (chosen) | New component; scales with folders × configs; one action per context |
| C | Dedicated "Launch" tree section | Always-visible state, but another panel and more vertical space |

B was picked in the brainstorm. Its running indicator covers C's main advantage without a new panel.

## Design

**Data.** New hook `useAllLaunchConfigs()` (in `hooks/use-launch-configs.ts`): `useQueries` over
`routing.folders`, calling `launchConfig.list` with `{ folder }` (no `folder` param when single-folder, keeping the
current query key). Returns a flat `LaunchEntry[]` (`{ folder, folderLabel, config }`) plus per-folder `errors`
(malformed `launch.json`).

**Running state.** Derived from `useTerminals()`: a config is running when a terminal has
`kind === 'launch'`, `name === config.name`, `folder === entry.folder` and `status === 'running'`.

**Picker (`LaunchPicker`, new, `components/workspace/`).** Dialog with a search input (autofocus), a list
and a footer.
- Row: ▶, name, folder tag (multi-folder only), `● rodando` when running.
- Empty query: running first, then recents, then the rest in folder order → file order.
- Query: ranked prefix > substring, ties by recents; matches name and folder label.
- Keys: ↑↓ move, ⏎ run, Esc close.
- ⏎ on a **running** config opens its existing terminal tab; ⇧⏎ starts another one.
- Unsupported entries hidden by default; footer toggle `Mostrar não suportadas (N)` reveals them disabled, with the
  existing reason tooltip.
- A folder whose `launch.json` is malformed shows one line at the top (`api: launch.json inválido — <error>`); other
  folders still list.
- Footer also has `Editar launch.json`, opening the file of the highlighted row's folder (primary folder when the
  list is empty). `onEditLaunchJson` gains a `folder` parameter.

**Recents.** `localStorage` key `launch-recents:<workspaceId>`, up to 8 `{ folder, name }`, updated on run. Reads and
writes wrapped in try/catch; the picker works without it.

**Entry points.**
- ＋▾ menu in `TerminalsSection`: the per-config items are replaced by a single `Executar configuração…` item that
  opens the picker (always, even with few configs — one path, fewer states). Shell items stay.
- `WorkspaceOverview` "Launch" card: shows at most 5 entries (running, then recents, then first ones) with the
  folder tag and a `Ver todas (N)…` row opening the picker. The card still hides when there are no configs.

## Left to the builder

- Exact visual styling (use existing theme tokens; verify in dark theme).
- Where the picker's open state lives (`WorkspaceScreen` vs local to each entry point) — one instance is preferable.
- How to translate a folder into the file-tab path: `onEditLaunchJson` (`WorkspaceScreen.tsx:375`) opens a bare
  `.vscode/launch.json`, which is not folder-aware. Use `useFolderRouting()` to build the aliased path.

## Calls made without the user (to confirm while reading)

1. Picker is the only way to run a config from the menu (no inline items).
2. ⏎ on a running config focuses it instead of starting a duplicate; ⇧⏎ duplicates.
3. Unsupported configs hidden by default behind a footer toggle.
4. Recents in `localStorage` per workspace id, max 8.
5. Overview card capped at 5 with `Ver todas`.

## Verification plan

- jsdom tests: `LaunchPicker` (filter, ranking, running state, ⏎/⇧⏎, unsupported toggle, per-folder error),
  `useAllLaunchConfigs` (multi vs single folder), `TerminalsSection` menu entry, `WorkspaceOverview` card cap.
- E2E (`e2e/product/…`): 2-folder workspace with distinct `launch.json`s; run from the picker; running indicator;
  scope switch Início ↔ workspace hides the entry. Run `npm run build` first.
- Lint + typecheck + tests green. Not verifiable by tests: visual look, dark theme, keyboard feel in the real app.
