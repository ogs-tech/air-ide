import { Fragment, useEffect, useRef, useState, type MutableRefObject } from 'react';
import { Box, IconButton, Stack, Tooltip, Typography } from '@mui/material';
import { ChevronDown, Plus } from 'lucide-react';
import { PANEL_HEADER_HEIGHT } from '../ds/ContainerChrome.js';
import { Icon } from '../ds/Icon.js';
import { WorkbenchTabItem } from './WorkbenchTabItem.js';
import type { WorkbenchTab } from './workbench-tab.js';

export type SwitcherFilter = 'needs-input';

export interface WorkbenchTabStripProps {
  tabs: readonly WorkbenchTab[];
  activeTabId: string | null;
  onSelect: (id: string) => void;
  /** Drag a tab onto another to reorder. */
  onReorder?: ((fromId: string, toId: string) => void) | undefined;
  /** Shared with the canvas so its file drop zone can tell a tab drag from an OS file drag. */
  dragId: MutableRefObject<string | null>;
  /** Right-click on a tab; the canvas decides whether the tab has a menu. */
  onTabContextMenu: (event: React.MouseEvent, tab: WorkbenchTab) => void;
  /** The trailing "+" button, hidden when absent. */
  onOpenNew?: ((anchor: HTMLElement) => void) | undefined;
  onOpenSwitcher: (anchor: HTMLElement, filter?: SwitcherFilter) => void;
}

/** The tab row: shrinking tabs, the switcher button (with the needs-input count) and the "+". */
export function WorkbenchTabStrip({ tabs, activeTabId, onSelect, onReorder, dragId, onTabContextMenu, onOpenNew, onOpenSwitcher }: WorkbenchTabStripProps): React.ReactElement {
  const stripRef = useRef<HTMLDivElement | null>(null);
  const [overflowing, setOverflowing] = useState(false);
  const needsInput = tabs.filter((tab) => tab.sessionState === 'needs-input').length;

  // The strip still scrolls as a last resort, so the active tab must never sit out of sight.
  useEffect(() => {
    if (activeTabId === null) return;
    const el = Array.from(stripRef.current?.querySelectorAll<HTMLElement>('[data-tab-id]') ?? []).find((node) => node.dataset.tabId === activeTabId);
    el?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
  }, [activeTabId, tabs.length]);

  // Offer the switcher when some tabs are actually hidden.
  useEffect(() => {
    const strip = stripRef.current;
    if (!strip) return;
    const measure = (): void => setOverflowing(strip.scrollWidth > strip.clientWidth + 1);
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(strip);
    return () => observer.disconnect();
  }, [tabs]);

  const showSwitcher = overflowing || needsInput > 0;
  return (
    <Stack
      direction="row"
      sx={(theme) => ({
        height: PANEL_HEADER_HEIGHT,
        boxSizing: 'border-box',
        alignItems: 'flex-end',
        flexShrink: 0,
        bgcolor: theme.ogs.workbench.strip,
        // The hairline under the strip is a background, so the active tab (painted above it) can cover its own slice and join the content.
        backgroundImage: `linear-gradient(${theme.palette.divider}, ${theme.palette.divider})`,
        backgroundSize: '100% 1px',
        backgroundPosition: 'bottom',
        backgroundRepeat: 'no-repeat',
      })}
    >
      <Stack
        ref={stripRef}
        direction="row"
        data-testid="workbench-tabs"
        sx={{ pl: 1, pr: 0.5, pt: 0.5, height: '100%', boxSizing: 'border-box', flex: 1, minWidth: 0, alignItems: 'flex-end', gap: '2px', overflowX: 'auto', scrollbarWidth: 'none', '&::-webkit-scrollbar': { display: 'none' } }}
      >
        {tabs.map((tab, index) => {
          const lastPinned = tab.pinned === true && !tabs[index + 1]?.pinned;
          return (
            <Fragment key={tab.id}>
              <WorkbenchTabItem
                tab={tab}
                active={tab.id === activeTabId}
                draggable={onReorder !== undefined && !tab.iconOnly}
                onSelect={() => onSelect(tab.id)}
                onContextMenu={(e) => onTabContextMenu(e, tab)}
                onDragStart={(e) => {
                  dragId.current = tab.id;
                  e.dataTransfer.effectAllowed = 'move';
                }}
                onDragOver={(e) => {
                  if (dragId.current !== null && dragId.current !== tab.id) e.preventDefault();
                }}
                onDrop={(e) => {
                  if (dragId.current === null) return;
                  e.preventDefault();
                  e.stopPropagation();
                  onReorder?.(dragId.current, tab.id);
                  dragId.current = null;
                }}
                onDragEnd={() => {
                  dragId.current = null;
                }}
              />
              {lastPinned && <Box aria-hidden data-testid="workbench-pinned-divider" sx={{ width: '1px', alignSelf: 'stretch', bgcolor: 'divider', mx: 0.5, my: 0.75, flexShrink: 0 }} />}
            </Fragment>
          );
        })}
      </Stack>
      <Stack direction="row" sx={{ flex: 'none', alignItems: 'center', gap: 0.25, pl: 0.5, pr: 1, height: '100%', pb: 0.25 }}>
        {showSwitcher && (
          <Tooltip title={needsInput > 0 ? `Todas as abas — ${needsInput} aguardando você` : 'Todas as abas'}>
            <IconButton
              size="small"
              data-testid="workbench-all-tabs"
              aria-label="Todas as abas"
              aria-haspopup="dialog"
              onClick={(e) => onOpenSwitcher(e.currentTarget, needsInput > 0 ? 'needs-input' : undefined)}
              sx={{ p: 0.5, color: 'text.secondary', gap: 0.25, borderRadius: 1 }}
            >
              <Icon glyph={ChevronDown} size={14} />
              <Typography component="span" sx={{ fontSize: '0.7rem' }}>{tabs.length}</Typography>
              {needsInput > 0 && (
                <Box
                  component="span"
                  data-testid="workbench-all-tabs-needs-input"
                  aria-label={`${needsInput} aguardando você`}
                  sx={(theme) => ({
                    minWidth: 16,
                    height: 16,
                    px: 0.5,
                    ml: 0.25,
                    boxSizing: 'border-box',
                    borderRadius: `${theme.ogs.radius.pill}px`,
                    bgcolor: 'warning.main',
                    color: theme.palette.warning.contrastText,
                    fontSize: '0.65rem',
                    fontWeight: 600,
                    lineHeight: '16px',
                    textAlign: 'center',
                  })}
                >
                  {needsInput}
                </Box>
              )}
            </IconButton>
          </Tooltip>
        )}
        {onOpenNew && (
          <Tooltip title="Novo…">
            <IconButton
              size="small"
              data-testid="workbench-new"
              aria-label="Novo…"
              aria-haspopup="menu"
              onClick={(e) => onOpenNew(e.currentTarget)}
              sx={{ p: 0.5, flexShrink: 0, color: 'text.secondary' }}
            >
              <Icon glyph={Plus} size={14} />
            </IconButton>
          </Tooltip>
        )}
      </Stack>
    </Stack>
  );
}
