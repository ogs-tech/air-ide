---
title: The five containers
description: Header, Explorer panel, Workbench, Control panel and footer — contents, behaviour and the e2e spec that covers each.
---

# The five containers

```
┌────────────────────── Header ──────────────────────┐
│ Explorer panel │     Workbench      │ Control panel │
├────────────────────── Footer ──────────────────────┤
```

| Container | What it holds | Behaviour worth knowing | e2e spec |
|---|---|---|---|
| **Header** | History arrows, the command-palette button (⌘K), two toggles for the side panels | A toggle hides its panel completely and gives the width to the Workbench; the toggle stays visible so you can bring the panel back | `e2e/product/shell/header.spec.ts` |
| **Explorer panel** (left) | A rail — Arquivos, Buscar, Git, Terminais, Navegador, Configurações — and the active view | Clicking the **active** rail item collapses the panel; the header toggle expands it again. At Início the rail holds the app's destinations instead | `explorer-panel.spec.ts` |
| **Workbench** (centre) | Tabs (files, sessions, entities, diffs, terminals), the breadcrumb of the active file, the **+** menu | The breadcrumb exists only for tabs with a path; with no tab open you see the overview | `workbench-panel.spec.ts` (session tabs: `e2e/product/sessions/`) |
| **Control panel** (right) | Sessões above, Customizações below | Each section collapses to its title; the search count follows what is on screen | `control-panel.spec.ts` |
| **Footer** | Workspace switcher, git branch, diagnostics pill, cursor and save state of the open file, sessions needing you | Present at Início too; the switcher goes Início ↔ workspaces | `footer.spec.ts` |

Related: [Manage workspaces](../../workspaces/how-to/manage-workspaces.md), [Edit files and navigate](../../editor/how-to/edit-files-and-navigate.md), [Diagnose and reset](../../troubleshooting/how-to/diagnose-and-reset.md) (the diagnostics pill).

## Test ids

Containers are addressed by `data-testid`: `workspace-files-panel`, `workbench-canvas-panel`, `workspace-customizations-aside` (the three panels, each with `data-collapsed`), `status-bar`, and `workspace-toggle-files` / `workspace-toggle-customizations` in the header. A collapsed panel stays in the DOM at width 0, so assert `data-collapsed` or the width, not visibility.
