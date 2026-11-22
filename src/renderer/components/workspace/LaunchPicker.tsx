import { useMemo, useState } from 'react';
import { Box, Dialog, TextField, Tooltip, Typography } from '@mui/material';
import { Play } from 'lucide-react';
import { Icon } from '../ds/Icon.js';
import { useAllLaunchConfigs, useRunLaunchConfig } from '../../hooks/use-launch-configs.js';
import { useFolderRouting } from '../../hooks/use-folder-routing.js';
import { useTerminals } from '../../hooks/use-terminals.js';
import { useActiveWorkspace } from '../../hooks/use-workspaces.js';
import { IpcCallError } from '../../lib/ipc.js';
import {
  dropStaleRecents,
  isRunning,
  pushLaunchRecent,
  rankLaunchEntries,
  readLaunchRecents,
  type LaunchEntry,
} from '../../lib/launch-picker.js';
import type { TerminalSnapshot } from '../../../shared/terminal.js';

interface LaunchPickerProps {
  open: boolean;
  onClose: () => void;
  /** Shows a terminal (new or already running) in the canvas. */
  onOpenTerminal: (terminal: TerminalSnapshot) => void;
  /** Opens the `launch.json` of a folder; `undefined` = the primary one. */
  onEditLaunchJson: (folder: string | undefined) => void;
  onError: (message: string) => void;
}

const rowId = (entry: LaunchEntry): string => `${entry.folderLabel || 'root'}-${entry.config.name}`;
const unsupportedReason = (entry: LaunchEntry): string =>
  `Tipo '${entry.config.type}'/request '${entry.config.request}' não suportado — só node/launch pode ser executado`;

/** Search-and-run over every folder's launch.json: ⏎ runs (or focuses the live one), ⇧⏎ always starts another. */
export function LaunchPicker(props: LaunchPickerProps): React.ReactElement {
  return (
    <Dialog
      open={props.open}
      onClose={props.onClose}
      fullWidth
      maxWidth="sm"
      data-testid="launch-picker"
      slotProps={{ paper: { sx: { overflow: 'hidden', alignSelf: 'flex-start', mt: '12vh' } } }}
    >
      {/* Mounted only while open, so every opening starts with a fresh query, highlight and toggle. */}
      <LaunchPickerBody {...props} />
    </Dialog>
  );
}

function LaunchPickerBody({ open, onClose, onOpenTerminal, onEditLaunchJson, onError }: LaunchPickerProps): React.ReactElement {
  const routing = useFolderRouting();
  const { data: workspace } = useActiveWorkspace();
  const { entries, errors } = useAllLaunchConfigs(open);
  const { data: terminals = [] } = useTerminals(open);
  const runConfig = useRunLaunchConfig();
  const [query, setQuery] = useState('');
  const [highlight, setHighlight] = useState(0);
  const [showUnsupported, setShowUnsupported] = useState(false);
  const workspaceId = workspace?.id ?? '';

  // Re-read on every open: a run from elsewhere (the overview card) updates the same key.
  const recents = useMemo(() => (open ? dropStaleRecents(readLaunchRecents(workspaceId), entries) : []), [open, workspaceId, entries]);
  const ranked = useMemo(() => rankLaunchEntries(entries, query, terminals, recents), [entries, query, terminals, recents]);
  const unsupportedCount = ranked.filter((e) => !e.config.supported).length;
  const rows = useMemo(
    () => [...ranked.filter((e) => e.config.supported), ...(showUnsupported ? ranked.filter((e) => !e.config.supported) : [])],
    [ranked, showUnsupported],
  );
  const active = Math.min(highlight, Math.max(rows.length - 1, 0));
  const highlighted = rows[active];

  const run = (entry: LaunchEntry, forceNew: boolean): void => {
    if (!entry.config.supported) return;
    const live = forceNew ? undefined : isRunning(entry, terminals);
    if (live) {
      onOpenTerminal(live);
      onClose();
      return;
    }
    runConfig.mutate(
      { configName: entry.config.name, ...(routing.multi ? { folder: entry.folder } : {}) },
      {
        onSuccess: (terminal) => {
          pushLaunchRecent(workspaceId, { folder: entry.folder, name: entry.config.name });
          onOpenTerminal(terminal);
          onClose();
        },
        onError: (err) => onError(err instanceof IpcCallError ? err.message : String(err)),
      },
    );
  };

  const hint = highlighted && isRunning(highlighted, terminals) ? '⏎ abrir  ⇧⏎ nova' : null;

  return (
    <>
      <Box sx={{ p: 1.5 }}>
        <TextField
          autoFocus
          fullWidth
          size="small"
          placeholder="Executar configuração…"
          value={query}
          slotProps={{ htmlInput: { 'data-testid': 'launch-picker-search', 'aria-label': 'Buscar configuração' } }}
          onChange={(e) => {
            setQuery(e.target.value);
            setHighlight(0);
          }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setHighlight(Math.min(active + 1, rows.length - 1));
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              setHighlight(Math.max(active - 1, 0));
            } else if (e.key === 'Enter' && highlighted !== undefined) {
              e.preventDefault();
              run(highlighted, e.shiftKey);
            }
          }}
        />
      </Box>
      {errors.map((err) => (
        <Typography key={err.folder} variant="caption" color="error" sx={{ display: 'block', mx: 1.5, mb: 1 }} data-testid={`launch-picker-error-${err.folderLabel || 'root'}`}>
          {err.folderLabel ? `${err.folderLabel}: ` : ''}launch.json inválido — {err.error}
        </Typography>
      ))}
      <Box role="listbox" aria-label="Configurações" sx={{ px: 0.75, pb: 0.75, maxHeight: 320, overflowY: 'auto' }}>
        {rows.map((entry, index) => {
          const live = isRunning(entry, terminals);
          const id = rowId(entry);
          const disabled = !entry.config.supported;
          const row = (
            <Box
              key={`${entry.folder}\u0000${entry.config.name}`}
              role="option"
              aria-selected={index === active}
              aria-disabled={disabled}
              data-testid={`launch-picker-row-${id}`}
              onMouseMove={() => setHighlight(index)}
              onClick={(e) => run(entry, e.shiftKey)}
              sx={(theme) => ({
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                gap: 1.25,
                px: 1.25,
                py: 0.9,
                borderRadius: `${theme.ogs.radius.sm}px`,
                cursor: disabled ? 'default' : 'pointer',
                opacity: disabled ? 0.45 : 1,
                bgcolor: index === active ? theme.ogs.surfaces.rail : 'transparent',
                '&::before': live
                  ? { content: '""', position: 'absolute', left: 0, top: 7, bottom: 7, width: 2, borderRadius: 1, bgcolor: 'success.main' }
                  : undefined,
              })}
            >
              <Box component="span" sx={{ display: 'inline-flex', color: 'text.secondary' }}><Icon glyph={Play} size={11} /></Box>
              <Typography component="span" noWrap sx={{ fontSize: '0.8rem', fontFamily: (t) => t.ogs.fonts.mono }}>{entry.config.name}</Typography>
              <Box sx={{ ml: 'auto', display: 'flex', alignItems: 'center', gap: 1.25, flexShrink: 0 }}>
                {entry.folderLabel && <Typography component="span" sx={{ fontSize: '0.72rem', color: 'text.secondary' }}>{entry.folderLabel}</Typography>}
                {live && (
                  <Typography
                    component="span"
                    data-testid={`launch-picker-running-${id}`}
                    sx={{ fontSize: '0.72rem', color: 'success.main', display: 'inline-flex', alignItems: 'center', gap: 0.6, '&::before': { content: '""', width: 6, height: 6, borderRadius: '50%', bgcolor: 'success.main' } }}
                  >
                    rodando
                  </Typography>
                )}
              </Box>
            </Box>
          );
          return disabled ? <Tooltip key={`${entry.folder}\u0000${entry.config.name}`} title={unsupportedReason(entry)}>{row}</Tooltip> : row;
        })}
        {rows.length === 0 && (
          <Typography variant="caption" color="text.secondary" data-testid="launch-picker-empty" sx={{ display: 'block', px: 1.25, py: 1.5 }}>
            {entries.length === 0 ? 'Nenhuma configuração encontrada. Crie uma em .vscode/launch.json.' : 'Nenhuma configuração corresponde à busca.'}
          </Typography>
        )}
      </Box>
      <Box
        sx={(theme) => ({
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          px: 1.75,
          py: 1,
          borderTop: `1px solid ${theme.palette.divider}`,
          bgcolor: theme.ogs.surfaces.input,
          fontSize: '0.75rem',
          color: 'text.secondary',
        })}
      >
        <Box
          component="button"
          type="button"
          data-testid="launch-picker-edit"
          onClick={() => {
            onEditLaunchJson(highlighted?.folder);
            onClose();
          }}
          sx={{ all: 'unset', cursor: 'pointer', color: 'primary.main', fontSize: 'inherit', '&:focus-visible': { outline: '2px solid', outlineColor: 'primary.main', borderRadius: 0.5 } }}
        >
          Editar launch.json
        </Box>
        <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center' }}>
          {hint && <span>{hint}</span>}
          {unsupportedCount > 0 || showUnsupported ? (
            <Box
              component="button"
              type="button"
              data-testid="launch-picker-toggle-unsupported"
              onClick={() => setShowUnsupported((v) => !v)}
              sx={{ all: 'unset', cursor: 'pointer', fontSize: 'inherit', '&:hover': { color: 'text.primary' }, '&:focus-visible': { outline: '2px solid', outlineColor: 'primary.main', borderRadius: 0.5 } }}
            >
              {showUnsupported ? 'Ocultar não suportadas' : `Mostrar não suportadas (${unsupportedCount})`}
            </Box>
          ) : null}
        </Box>
      </Box>
    </>
  );
}
