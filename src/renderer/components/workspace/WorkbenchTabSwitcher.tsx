import { useMemo, useState } from 'react';
import { Box, Chip, InputBase, Popover, Stack, Typography } from '@mui/material';
import { Search } from 'lucide-react';
import { Icon } from '../ds/Icon.js';
import { SessionStateMark } from '../SessionStateMark.js';
import { FILTER_LABELS } from '../../lib/session-attention.js';
import { toneColor } from '../../lib/file-icon.js';
import { tabToneColor, type TabKind } from '../../lib/tab-tone.js';
import type { WorkbenchTab } from './workbench-tab.js';

const GROUP_ORDER = ['Sessões', 'Arquivos', 'Git', 'Navegador', 'Customizações', 'Terminais', 'Outras'] as const;

/** Which switcher group a tab kind lives in. */
export function switcherGroupOf(kind: TabKind): (typeof GROUP_ORDER)[number] {
  switch (kind) {
    case 'session':
      return 'Sessões';
    case 'file':
      return 'Arquivos';
    case 'git-diff':
      return 'Git';
    case 'browser':
      return 'Navegador';
    case 'skill':
    case 'agent':
    case 'instruction':
    case 'mcp':
      return 'Customizações';
    case 'terminal':
      return 'Terminais';
    default:
      return 'Outras';
  }
}

export interface WorkbenchTabSwitcherProps {
  tabs: readonly WorkbenchTab[];
  activeTabId: string | null;
  anchor: HTMLElement | null;
  initialFilter?: 'needs-input' | undefined;
  onSelect: (id: string) => void;
  onClose: () => void;
}

/** Search + grouped list of every open tab. ↑/↓ move, ↵ opens, Esc closes. */
export function WorkbenchTabSwitcher({ tabs, activeTabId, anchor, initialFilter, onSelect, onClose }: WorkbenchTabSwitcherProps): React.ReactElement {
  const [query, setQuery] = useState('');
  const [onlyNeedsInput, setOnlyNeedsInput] = useState(initialFilter === 'needs-input');
  const [cursor, setCursor] = useState(0);
  const needsInputCount = tabs.filter((tab) => tab.sessionState === 'needs-input').length;

  const groups = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const visible = tabs.filter((tab) => {
      if (onlyNeedsInput && tab.sessionState !== 'needs-input') return false;
      if (!needle) return true;
      return tab.label.toLowerCase().includes(needle) || (tab.breadcrumb ?? '').toLowerCase().includes(needle);
    });
    return GROUP_ORDER.map((name) => ({ name, tabs: visible.filter((tab) => switcherGroupOf(tab.kind) === name) })).filter((group) => group.tabs.length > 0);
  }, [tabs, query, onlyNeedsInput]);
  const flat = groups.flatMap((group) => group.tabs);
  const current = Math.min(cursor, Math.max(flat.length - 1, 0));

  const choose = (id: string): void => {
    onSelect(id);
    onClose();
  };

  return (
    <Popover
      open={anchor !== null}
      anchorEl={anchor}
      onClose={onClose}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      slotProps={{ paper: { sx: { width: 360, maxWidth: 'calc(100vw - 24px)' } } }}
    >
      <Box data-testid="workbench-switcher" sx={{ display: 'flex', flexDirection: 'column', maxHeight: 420 }}>
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center', px: 1.5, py: 1, borderBottom: 1, borderColor: 'divider', flex: 'none' }}>
          <Icon glyph={Search} size={14} />
          <InputBase
            autoFocus
            fullWidth
            placeholder="Buscar aba"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setCursor(0);
            }}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                setCursor(Math.min(current + 1, flat.length - 1));
              } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setCursor(Math.max(current - 1, 0));
              } else if (e.key === 'Enter') {
                e.preventDefault();
                const target = flat[current];
                if (target) choose(target.id);
              } else if (e.key === 'Escape') {
                e.preventDefault();
                onClose();
              }
            }}
            inputProps={{
              'data-testid': 'workbench-switcher-filter',
              'aria-label': 'Buscar aba',
              role: 'combobox',
              'aria-expanded': true,
              'aria-controls': 'workbench-switcher-list',
              ...(flat[current] ? { 'aria-activedescendant': `workbench-all-tabs-${flat[current].id}` } : {}),
            }}
            sx={{ fontSize: '0.85rem' }}
          />
          {needsInputCount > 0 && (
            <Chip
              size="small"
              clickable
              data-testid="workbench-switcher-needs-input"
              color={onlyNeedsInput ? 'warning' : 'default'}
              label={`Aguardando você · ${needsInputCount}`}
              onClick={() => {
                setOnlyNeedsInput((value) => !value);
                setCursor(0);
              }}
            />
          )}
        </Stack>
        <Box id="workbench-switcher-list" role="listbox" sx={{ overflowY: 'auto', py: 0.5 }}>
          {groups.length === 0 && (
            <Typography sx={{ px: 1.5, py: 1.5, fontSize: '0.8rem', color: 'text.secondary' }}>Nenhuma aba encontrada.</Typography>
          )}
          {groups.map((group) => (
            <Box key={group.name} role="group" aria-label={group.name}>
              <Typography sx={{ px: 1.5, pt: 1, pb: 0.25, fontSize: '0.7rem', fontWeight: 600, color: 'text.secondary' }}>{group.name}</Typography>
              {group.tabs.map((tab) => {
                const selected = flat[current]?.id === tab.id;
                return (
                  <Box
                    key={tab.id}
                    id={`workbench-all-tabs-${tab.id}`}
                    role="option"
                    aria-selected={selected}
                    data-testid={`workbench-all-tabs-${tab.id}`}
                    data-active={tab.id === activeTabId ? 'true' : 'false'}
                    onClick={() => choose(tab.id)}
                    onMouseMove={() => setCursor(flat.indexOf(tab))}
                    sx={(theme) => ({
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1,
                      px: 1.5,
                      py: 0.625,
                      cursor: 'pointer',
                      bgcolor: selected ? 'action.hover' : 'transparent',
                      boxShadow: tab.id === activeTabId ? `inset 2px 0 0 ${tabToneColor(theme, tab.kind, tab.sessionChannel)}` : 'none',
                    })}
                  >
                    <Box component="span" sx={(theme) => ({ display: 'inline-flex', flex: 'none', color: toneColor(theme, tab.glyphTone) ?? tabToneColor(theme, tab.kind, tab.sessionChannel) })}>
                      <Icon glyph={tab.glyph} size={14} />
                    </Box>
                    <Box sx={{ minWidth: 0, flex: 1 }}>
                      <Typography noWrap sx={{ fontSize: '0.82rem' }}>{tab.label}</Typography>
                      {tab.breadcrumb && (
                        <Typography noWrap sx={(theme) => ({ fontSize: '0.7rem', color: 'text.secondary', fontFamily: theme.ogs.fonts.mono })}>{tab.breadcrumb}</Typography>
                      )}
                    </Box>
                    {tab.sessionState && (
                      <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center', flex: 'none' }}>
                        <SessionStateMark state={tab.sessionState} />
                        <Typography component="span" sx={{ fontSize: '0.7rem', color: 'text.secondary' }}>{FILTER_LABELS[tab.sessionState]}</Typography>
                      </Stack>
                    )}
                  </Box>
                );
              })}
            </Box>
          ))}
        </Box>
      </Box>
    </Popover>
  );
}
