import { Box, Button, Stack, Typography } from '@mui/material';
import { GitBranch, NotebookPen, Play, Plus, SquareTerminal } from 'lucide-react';
import { Icon } from '../../ds/Icon.js';
import { StatusPill } from '../../ds/StatusPill.js';
import { OverviewCard, OverviewGrid, OverviewLink, OverviewRow, todayFilters } from './OverviewCard.js';
import { useGitInit, useGitStatus } from '../../../hooks/use-git.js';
import { useSessions } from '../../../hooks/use-sessions.js';
import { useSessionHistoryStats } from '../../../hooks/use-session-history.js';
import { useWorkspaceInstruction } from '../../../hooks/use-instructions.js';
import { useAllLaunchConfigs, useRunLaunchConfig } from '../../../hooks/use-launch-configs.js';
import { useFolderRouting } from '../../../hooks/use-folder-routing.js';
import { useTerminals } from '../../../hooks/use-terminals.js';
import { dropStaleRecents, pushLaunchRecent, rankLaunchEntries, readLaunchRecents } from '../../../lib/launch-picker.js';
import { seedWorkspaceInstruction } from '../../../lib/instruction-seed.js';
import { formatCostUsd, formatWhen } from '../../../lib/format-session-history.js';
import type { Instruction } from '../../../../shared/entity.js';
import type { TerminalSnapshot } from '../../../../shared/terminal.js';
import type { SessionSnapshot } from '../../../../shared/session.js';
import type { Workspace } from '../../../../shared/workspace.js';

interface WorkspaceOverviewProps {
  workspace: Workspace;
  /** Whether the overview tab is on screen — git status polls only then. */
  visible: boolean;
  /** "Ver alterações": switches the left panel to its Git view. */
  onShowGit: () => void;
  onNewSession: () => void;
  onOpenSession: (session: SessionSnapshot) => void;
  onOpenInstruction: (entity: Instruction, isCreate: boolean) => void;
  onOpenTerminal: (terminal: TerminalSnapshot) => void;
  /** "Ver todas": opens the workspace-wide launch picker. */
  onOpenLaunchPicker: () => void;
  onError: (message: string) => void;
}

/** The card is a shortcut to the likely runs; the picker holds the rest. */
const LAUNCH_CARD_MAX = 5;

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function lineCount(text: string): number {
  return text === '' ? 0 : text.split('\n').length;
}

/** A workspace's Visão geral: git, its sessions, its instruction and its launch configs. */
export function WorkspaceOverview({
  workspace,
  visible,
  onShowGit,
  onNewSession,
  onOpenSession,
  onOpenInstruction,
  onOpenTerminal,
  onOpenLaunchPicker,
  onError,
}: WorkspaceOverviewProps): React.ReactElement {
  const { data: git } = useGitStatus({ visible });
  const gitInit = useGitInit();
  const { data: sessions } = useSessions();
  const { data: todayStats } = useSessionHistoryStats({ kind: 'workspace', workspaceId: workspace.id }, todayFilters());
  const { data: instruction } = useWorkspaceInstruction(workspace.id);
  const { entries: launchEntries } = useAllLaunchConfigs();
  const { data: terminals = [] } = useTerminals();
  const routing = useFolderRouting();
  const runConfig = useRunLaunchConfig();

  // Activation kills every session of the context being left, so whatever is
  // live is this workspace's.
  const live = (sessions ?? []).filter((s) => s.status === 'running' && s.scopeId === workspace.id);
  const rankedLaunch = rankLaunchEntries(launchEntries, '', terminals, dropStaleRecents(readLaunchRecents(workspace.id), launchEntries));
  const launchShown = rankedLaunch.slice(0, LAUNCH_CARD_MAX);

  return (
    <OverviewGrid testId="workspace-overview">
      <OverviewCard
        testId="overview-card-git"
        glyph={GitBranch}
        title="Git"
        {...(git?.isRepo ? { action: <OverviewLink testId="overview-show-git" onClick={onShowGit}>Ver alterações</OverviewLink> } : {})}
      >
        {git === undefined ? (
          <Typography sx={{ fontSize: '0.8125rem', color: 'text.secondary' }}>Lendo…</Typography>
        ) : !git.isRepo ? (
          <Box>
            <Typography sx={{ fontSize: '0.8125rem', color: 'text.secondary', mb: 1 }}>Esta pasta não é um repositório git.</Typography>
            <Button
              size="small"
              variant="outlined"
              data-testid="overview-git-init"
              disabled={gitInit.isPending}
              onClick={() => gitInit.mutateAsync({}).catch((err: unknown) => onError(errorMessage(err)))}
            >
              Inicializar repositório
            </Button>
          </Box>
        ) : (
          <>
            <OverviewRow testId="overview-git-branch" glyph={GitBranch} primary={git.head.name ?? '(detached)'} />
            <OverviewRow
              testId="overview-git-changes"
              primary={git.files.length === 0 ? 'Sem alterações' : `${git.files.length}${git.truncated ? '+' : ''} alteração(ões)`}
              {...(git.head.upstream ? { secondary: `↑${git.head.ahead} ↓${git.head.behind}` } : {})}
            />
          </>
        )}
      </OverviewCard>

      <OverviewCard
        testId="overview-card-sessions"
        glyph={SquareTerminal}
        title="Sessões"
        action={
          <OverviewLink testId="overview-new-session" onClick={onNewSession}>
            <Icon glyph={Plus} size={12} /> Nova sessão
          </OverviewLink>
        }
        footer={<span data-testid="overview-today-spend">Hoje: {formatCostUsd(todayStats?.totalCostUsd ?? 0)}</span>}
      >
        {live.length === 0 ? (
          <Typography sx={{ fontSize: '0.8125rem', color: 'text.secondary' }}>Nenhuma sessão rodando.</Typography>
        ) : (
          live.map((s) => (
            <OverviewRow
              key={s.sessionId}
              testId={`overview-session-${s.sessionId}`}
              glyph={SquareTerminal}
              primary={s.label}
              trailing={<StatusPill variant="running" />}
              onClick={() => onOpenSession(s)}
            />
          ))
        )}
      </OverviewCard>

      <OverviewCard testId="overview-card-instruction" glyph={NotebookPen} title="Instruction do workspace">
        {instruction ? (
          <OverviewRow
            testId="overview-instruction-open"
            glyph={NotebookPen}
            primary={instruction.name}
            secondary={`${lineCount(instruction.content)} linhas`}
            {...(instruction.metadata.updatedAt ? { trailing: <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>{formatWhen(instruction.metadata.updatedAt)}</Typography> } : {})}
            onClick={() => onOpenInstruction(instruction, false)}
          />
        ) : (
          <Button
            size="small"
            variant="outlined"
            data-testid="overview-instruction-create"
            startIcon={<Icon glyph={Plus} size={14} />}
            onClick={() => onOpenInstruction(seedWorkspaceInstruction(workspace), true)}
          >
            Criar instruction
          </Button>
        )}
      </OverviewCard>

      {rankedLaunch.length > 0 && (
        <OverviewCard
          testId="overview-card-launch"
          glyph={Play}
          title="Launch"
          {...(rankedLaunch.length > LAUNCH_CARD_MAX
            ? { action: <OverviewLink testId="overview-launch-see-all" onClick={onOpenLaunchPicker}>{`Ver todas (${rankedLaunch.length})…`}</OverviewLink> }
            : {})}
        >
          {launchShown.map((entry) => {
            const { config } = entry;
            const id = entry.folderLabel ? `${config.name}-${entry.folderLabel}` : config.name;
            return (
              <OverviewRow
                key={`${entry.folder}\u0000${config.name}`}
                testId={`overview-launch-${id}`}
                primary={config.name}
                secondary={entry.folderLabel || config.type}
                trailing={
                  config.supported ? (
                    <Stack direction="row">
                      <Button
                        size="small"
                        data-testid={`overview-launch-run-${id}`}
                        aria-label={`Executar ${config.name}`}
                        sx={{ minWidth: 0, p: 0.25 }}
                        onClick={() =>
                          runConfig.mutate(
                            { configName: config.name, ...(routing.multi ? { folder: entry.folder } : {}) },
                            {
                              onSuccess: (terminal) => {
                                pushLaunchRecent(workspace.id, { folder: entry.folder, name: config.name });
                                onOpenTerminal(terminal);
                              },
                              onError: (err) => onError(errorMessage(err)),
                            },
                          )
                        }
                      >
                        <Icon glyph={Play} size={14} />
                      </Button>
                    </Stack>
                  ) : undefined
                }
              />
            );
          })}
        </OverviewCard>
      )}
    </OverviewGrid>
  );
}
