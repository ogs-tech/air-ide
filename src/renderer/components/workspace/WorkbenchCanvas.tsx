import { useRef, useState } from 'react';
import { Box, ListItemIcon, ListItemText, Menu, MenuItem, Typography } from '@mui/material';
import { TREE_DRAG_TYPE, readTreeDrag } from '../../lib/tree-drag.js';
import { Icon } from '../ds/Icon.js';
import { RowContextMenu, useRowContextMenu, type RowContextMenuAction } from './RowContextMenu.js';
import { WorkbenchTabStrip, type SwitcherFilter } from './WorkbenchTabStrip.js';
import { WorkbenchTabSwitcher } from './WorkbenchTabSwitcher.js';
import type { WorkbenchTab } from './workbench-tab.js';

export type { WorkbenchTab } from './workbench-tab.js';

const BREADCRUMB_HEIGHT = 26;

interface WorkbenchCanvasProps {
  tabs: readonly WorkbenchTab[];
  activeTabId: string | null;
  onSelect: (id: string) => void;
  /** Drag a tab onto another to reorder. */
  onReorder?: (fromId: string, toId: string) => void;
  /** Right-click menu for a tab; omitted or empty means no menu. */
  tabMenu?: (tab: WorkbenchTab) => RowContextMenuAction[];
  /** Creation shortcuts behind the strip's trailing "+" (Nova sessão, Novo terminal…); omitted or empty hides the button. */
  newMenu?: readonly RowContextMenuAction[];
  /** Files dropped on the editor area: OS files (absolute paths via `getPathForFile`) or tree paths. */
  onDropFiles?: (drop: { files: File[]; treePaths: string[] }) => void;
}

/**
 * The Sublime-like editing surface to the right of the Workspace tree — every
 * open file AND every open Skill/Agent/Instruction tab lives here, all
 * rendered through the same EditorPanel; sessions share the tab strip too.
 */
export function WorkbenchCanvas({ tabs, activeTabId, onSelect, onReorder, tabMenu, newMenu, onDropFiles }: WorkbenchCanvasProps): React.ReactElement {
  const menu = useRowContextMenu<WorkbenchTab>();
  const dragId = useRef<string | null>(null);
  const activeTab = tabs.find((tab) => tab.id === activeTabId);
  const [newAnchor, setNewAnchor] = useState<HTMLElement | null>(null);
  const hasNewMenu = (newMenu?.length ?? 0) > 0;
  const [switcher, setSwitcher] = useState<{ anchor: HTMLElement; filter: SwitcherFilter | undefined } | null>(null);

  return (
    <Box data-testid="workbench-canvas" sx={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0, minHeight: 0 }}>
      {(tabs.length > 0 || hasNewMenu) && (
        <WorkbenchTabStrip
          tabs={tabs}
          activeTabId={activeTabId}
          onSelect={onSelect}
          onReorder={onReorder}
          dragId={dragId}
          onTabContextMenu={(e, tab) => {
            if ((tabMenu?.(tab).length ?? 0) > 0) menu.openMenu(e, tab);
          }}
          onOpenNew={hasNewMenu ? setNewAnchor : undefined}
          onOpenSwitcher={(anchor, filter) => setSwitcher({ anchor, filter })}
        />
      )}
      {switcher && (
        <WorkbenchTabSwitcher
          key={switcher.filter ?? 'all'}
          tabs={tabs}
          activeTabId={activeTabId}
          anchor={switcher.anchor}
          initialFilter={switcher.filter}
          onSelect={onSelect}
          onClose={() => setSwitcher(null)}
        />
      )}
      <Menu open={newAnchor !== null} anchorEl={newAnchor} onClose={() => setNewAnchor(null)}>
        {(newMenu ?? []).map((action) => (
          <MenuItem
            key={action.key}
            data-testid={`workbench-new-${action.key}`}
            onClick={() => {
              setNewAnchor(null);
              action.onSelect(newAnchor as HTMLElement);
            }}
          >
            <ListItemIcon><Icon glyph={action.glyph} size={14} /></ListItemIcon>
            <ListItemText primary={action.label} />
            {action.shortcut !== undefined && (
              <Typography component="span" variant="caption" sx={{ ml: 3, color: 'text.secondary' }}>{action.shortcut}</Typography>
            )}
          </MenuItem>
        ))}
      </Menu>
      {/* Only tabs with a path get the row; an empty bar above a terminal reads as a glitch. */}
      {activeTab?.breadcrumb != null && (
        <Box
          data-testid="workbench-breadcrumb"
          sx={(theme) => ({
            px: 1.5,
            height: BREADCRUMB_HEIGHT,
            boxSizing: 'border-box',
            display: 'flex',
            alignItems: 'center',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            bgcolor: 'background.paper',
            borderBottom: 1,
            borderColor: 'divider',
            flexShrink: 0,
            fontFamily: theme.ogs.fonts.mono,
            fontSize: '0.75rem',
            color: 'text.secondary',
          })}
        >
          {activeTab?.breadcrumb}
        </Box>
      )}
      <RowContextMenu state={menu.state} onClose={menu.closeMenu} actions={menu.state ? (tabMenu?.(menu.state.target) ?? []) : []} />
      <Box
        sx={{ flex: 1, minHeight: 0, overflow: 'auto' }}
        onDragOver={(e) => {
          if (onDropFiles && dragId.current === null && (Array.from(e.dataTransfer.types).includes('Files') || Array.from(e.dataTransfer.types).includes(TREE_DRAG_TYPE))) e.preventDefault();
        }}
        onDrop={(e) => {
          if (!onDropFiles || dragId.current !== null) return;
          const treePaths = readTreeDrag(e.dataTransfer);
          const files = Array.from(e.dataTransfer.files);
          if (treePaths.length === 0 && files.length === 0) return;
          e.preventDefault();
          onDropFiles({ files, treePaths });
        }}
      >
        {tabs.map((tab) => (
          <Box
            key={tab.id}
            sx={{ display: tab.id === activeTabId ? 'block' : 'none', height: '100%', p: tab.dense ? 0 : 2 }}
          >
            {tab.render(tab.id !== activeTabId)}
          </Box>
        ))}
      </Box>
    </Box>
  );
}
