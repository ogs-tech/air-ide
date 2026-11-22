import { keyframes } from '@mui/material';
import { Box, Stack, Tooltip, Typography } from '@mui/material';
import { X } from 'lucide-react';
import { SessionStateMark } from '../SessionStateMark.js';
import { ChannelStateMark } from '../ChannelStateMark.js';
import { Icon } from '../ds/Icon.js';
import { FILTER_LABELS } from '../../lib/session-attention.js';
import { toneColor } from '../../lib/file-icon.js';
import { tabToneColor } from '../../lib/tab-tone.js';
import type { WorkbenchTab } from './workbench-tab.js';

/** One soft ring per 2 s on an inactive tab that is waiting on the user — the only state that asks for you. */
const attentionRing = keyframes`0% { opacity: 0.7; transform: scale(0.96); } 70%, 100% { opacity: 0; transform: scale(1.04); }`;

/** Inactive tabs shrink down to this: glyph + state dot, the label clipped away. */
const TIGHT_MIN_WIDTH = 34;
const INACTIVE_MAX_WIDTH = 150;
const ACTIVE_LABEL_MAX_WIDTH = 240;

/** A tab's tooltip: the session state (+ detail) or, when the label may be clipped, the label itself. */
function tabTooltip(tab: WorkbenchTab, active: boolean): string {
  if (tab.sessionState) {
    const state = tab.sessionDetail ? `${FILTER_LABELS[tab.sessionState]} — ${tab.sessionDetail}` : FILTER_LABELS[tab.sessionState];
    return active ? state : `${tab.label} · ${state}`;
  }
  return tab.iconOnly || tab.pinned || !active ? tab.label : '';
}

function TabGlyph({ tab }: { tab: WorkbenchTab }): React.ReactElement {
  if (tab.sessionState && tab.sessionChannel) {
    return (
      <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', pr: 0.25, flex: 'none' }}>
        <ChannelStateMark channel={tab.sessionChannel} state={tab.sessionState} testId={`workbench-tab-state-${tab.id}`} size={14} />
      </Box>
    );
  }
  return (
    <Box component="span" sx={(theme) => ({ display: 'inline-flex', alignItems: 'center', gap: 0.5, flex: 'none', color: toneColor(theme, tab.glyphTone) ?? tabToneColor(theme, tab.kind, tab.sessionChannel) })}>
      <Icon glyph={tab.glyph} size={14} />
      {tab.sessionState && <SessionStateMark state={tab.sessionState} testId={`workbench-tab-state-${tab.id}`} />}
    </Box>
  );
}

export interface WorkbenchTabItemProps {
  tab: WorkbenchTab;
  active: boolean;
  /** The tab is draggable (reorderable). */
  draggable: boolean;
  onSelect: () => void;
  onContextMenu: (event: React.MouseEvent) => void;
  onDragStart: (event: React.DragEvent) => void;
  onDragOver: (event: React.DragEvent) => void;
  onDrop: (event: React.DragEvent) => void;
  onDragEnd: () => void;
}

/** One tab. Active: sized to its label, paper surface, top rule in the kind's tone. Inactive: shares what's left, down to glyph + state dot. */
export function WorkbenchTabItem({ tab, active, draggable, onSelect, onContextMenu, onDragStart, onDragOver, onDrop, onDragEnd }: WorkbenchTabItemProps): React.ReactElement {
  const compact = tab.iconOnly === true || tab.pinned === true;
  const canClose = tab.onClose !== undefined && !tab.pinned;
  return (
    <Tooltip title={tabTooltip(tab, active)}>
      <Box
        role="button"
        tabIndex={0}
        aria-pressed={active}
        aria-label={tab.dirty ? `${tab.label} (não salvo)` : tab.label}
        data-testid={`workbench-tab-${tab.id}`}
        data-tab-id={tab.id}
        data-active={active ? 'true' : 'false'}
        data-kind={tab.kind}
        onClick={onSelect}
        onAuxClick={(e) => {
          if (e.button === 1 && tab.onClose) {
            e.preventDefault();
            tab.onClose();
          }
        }}
        onContextMenu={onContextMenu}
        draggable={draggable}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDrop={onDrop}
        onDragEnd={onDragEnd}
        onKeyDown={(e) => {
          if (e.key !== 'Enter' && e.key !== ' ') return;
          if (e.key === ' ') e.preventDefault();
          onSelect();
        }}
        sx={(theme) => {
          const tone = tabToneColor(theme, tab.kind, tab.sessionChannel);
          const { workbench, radius } = theme.ogs;
          return {
            display: 'flex',
            alignItems: 'center',
            position: 'relative',
            boxSizing: 'border-box',
            cursor: 'pointer',
            overflow: 'hidden',
            height: '100%',
            borderLeft: '1px solid',
            borderRight: '1px solid',
            borderColor: active ? theme.palette.divider : 'transparent',
            // After `borderColor`, so the rule keeps the tone. Always 2px: activating a tab never shifts its content.
            borderTop: `2px solid ${active ? tone : 'transparent'}`,
            borderRadius: `${radius.xs}px ${radius.xs}px 0 0`,
            color: active ? 'text.primary' : 'text.secondary',
            bgcolor: active ? workbench.tabActive : 'transparent',
            // A closed session's tab recedes; it stays reachable.
            opacity: tab.sessionState === 'exited' && !active ? 0.6 : 1,
            ...(active || compact
              ? { flexGrow: 0, flexShrink: 0, flexBasis: 'auto' }
              : { flexGrow: 1, flexShrink: 1, flexBasis: 0, minWidth: TIGHT_MIN_WIDTH, maxWidth: INACTIVE_MAX_WIDTH }),
            '@media (prefers-reduced-motion: no-preference)': {
              transition: 'background-color 0.2s ease, color 0.2s ease, opacity 0.25s ease',
              ...(tab.sessionState === 'needs-input' && !active
                ? {
                    '&::before': {
                      content: '""',
                      position: 'absolute',
                      inset: 0,
                      borderRadius: 'inherit',
                      border: `1px solid ${theme.palette.warning.main}`,
                      pointerEvents: 'none',
                      animation: `${attentionRing} 2s ease-out infinite`,
                    },
                  }
                : {}),
            },
            '&:hover': active ? {} : { bgcolor: workbench.tabHover },
            // On a tight inactive tab the close control would crowd the glyph: it appears on hover / focus only.
            ...(active || compact ? {} : { '& .workbench-tab-close': { display: 'none' } }),
            '&:hover .workbench-tab-close, &:focus-within .workbench-tab-close': { color: 'text.secondary', display: 'inline-flex' },
            '&:hover .workbench-tab-dirty, &:focus-within .workbench-tab-dirty': { display: canClose ? 'none' : undefined },
          };
        }}
      >
        <Stack
          direction="row"
          spacing={0.75}
          sx={{ alignItems: 'center', minWidth: 0, width: '100%', pl: compact ? 1 : 1.25, pr: canClose ? 0.5 : compact ? 1 : 1.25, minHeight: 24 }}
        >
          {compact || !tab.accentColor ? (
            <TabGlyph tab={tab} />
          ) : (
            <Box aria-hidden sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: tab.accentColor, flexShrink: 0 }} />
          )}
          {!compact && (
            <Typography
              noWrap
              sx={{
                fontSize: '0.8rem',
                fontWeight: active ? 500 : 400,
                minWidth: 0,
                // Inactive: the label gives way first (overflow clips it entirely when the tab is tight).
                flex: active ? '0 0 auto' : '1 1 auto',
                maxWidth: active ? ACTIVE_LABEL_MAX_WIDTH : 'none',
              }}
            >
              {tab.label}
            </Typography>
          )}
          {tab.dirty && (
            <Box
              className="workbench-tab-dirty"
              data-testid={`workbench-tab-dirty-${tab.id}`}
              aria-hidden
              sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: 'warning.main', flexShrink: 0, mr: tab.pinned ? 0 : 0.5 }}
            />
          )}
          {canClose && (
            <Box
              component="span"
              role="button"
              tabIndex={0}
              aria-label={`${tab.closeLabel ?? 'Fechar'} ${tab.label}`}
              data-testid={`workbench-tab-close-${tab.id}`}
              onClick={(e) => {
                e.stopPropagation();
                tab.onClose?.();
              }}
              onKeyDown={(e) => {
                if (e.key !== 'Enter' && e.key !== ' ') return;
                if (e.key === ' ') e.preventDefault();
                e.stopPropagation();
                tab.onClose?.();
              }}
              className="workbench-tab-close"
              sx={(theme) => ({
                // A dirty tab shows its dot in the close button's place until hovered.
                display: tab.dirty ? 'none' : 'inline-flex',
                flex: 'none',
                p: 0.5,
                ml: 0.25,
                borderRadius: `${theme.ogs.radius.pill}px`,
                color: 'text.disabled',
                '&:hover': { bgcolor: 'action.hover' },
              })}
            >
              <Icon glyph={X} size={12} />
            </Box>
          )}
        </Stack>
      </Box>
    </Tooltip>
  );
}
