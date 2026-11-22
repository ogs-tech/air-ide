import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HomeOverview } from '../../../../src/renderer/components/workspace/overview/HomeOverview.js';
import { WorkspaceOverview } from '../../../../src/renderer/components/workspace/overview/WorkspaceOverview.js';
import { todayFilters } from '../../../../src/renderer/components/workspace/overview/OverviewCard.js';
import { mockApi, ok, renderWithShell, type CallSpy } from '../../test-utils.js';
import type { Workspace } from '../../../../src/shared/workspace.js';

const ACME: Workspace = { id: 'w1', name: 'Acme', rootPath: '/repos/acme', createdAt: '', lastOpenedAt: '2026-10-10T10:00:00.000Z' };
const BRAVO: Workspace = { id: 'w2', name: 'Bravo', rootPath: '/repos/bravo', createdAt: '', lastOpenedAt: '2026-10-11T10:00:00.000Z' };

const RUNNING = {
  sessionId: 'personal', conversationId: 'c1', anchor: { kind: 'personal' }, scopeId: null, cwd: '/home/u',
  label: 'Início', status: 'running', browserEnabled: false,
};

let call: CallSpy;
const answer = (answers: Record<string, unknown>) =>
  call.mockImplementation(async (method: string) => ok(method in answers ? answers[method] : undefined));

beforeEach(() => {
  localStorage.clear();
  call = mockApi();
});

describe('todayFilters', () => {
  it('pins both bounds to local midday today, so no timezone shifts the day', () => {
    const { from, to } = todayFilters(new Date(2026, 9, 12, 23, 30));
    expect(from).toBe(to);
    const midday = new Date(from);
    expect([midday.getFullYear(), midday.getMonth(), midday.getDate(), midday.getHours()]).toEqual([2026, 9, 12, 12]);
  });
});

describe('HomeOverview', () => {
  const renderHome = (props: Partial<React.ComponentProps<typeof HomeOverview>> = {}) =>
    renderWithShell(
      <HomeOverview onOpenSession={vi.fn()} onOpenHistory={vi.fn()} onOpenDiagnostics={vi.fn()} {...props} />,
    );

  it('lists running sessions, opens one on click, and shows today\'s spend with a history link', async () => {
    const user = userEvent.setup();
    const onOpenSession = vi.fn();
    const onOpenHistory = vi.fn();
    answer({ 'session.list': [RUNNING], 'sessionHistory.stats': { totalCostUsd: 1.5, unpricedCount: 0, sessionCount: 1, perDay: [], models: [] } });
    renderHome({ onOpenSession, onOpenHistory });
    await user.click(await screen.findByTestId('overview-session-personal'));
    expect(onOpenSession).toHaveBeenCalledWith(expect.objectContaining({ sessionId: 'personal' }));
    await waitFor(() => expect(screen.getByTestId('overview-today-spend')).toHaveTextContent('1.50'));
    expect(call).toHaveBeenCalledWith('sessionHistory.stats', expect.objectContaining({ scope: { kind: 'all' } }));
    await user.click(screen.getByTestId('overview-see-history'));
    expect(onOpenHistory).toHaveBeenCalled();
  });

  it('does not repeat the workspaces list — the left panel owns it', async () => {
    answer({ 'workspace.list': [ACME, BRAVO], 'workspace.getActive': null });
    renderHome();
    await screen.findByTestId('overview-card-sessions');
    expect(screen.queryByTestId('overview-card-recents')).not.toBeInTheDocument();
  });

  it('shows the worst health severity, the top two problems, and links to Diagnóstico', async () => {
    const user = userEvent.setup();
    const onOpenDiagnostics = vi.fn();
    const check = (id: string, severity: string) => ({ id, category: 'symlink', severity, title: `check ${id}`, observedAt: '' });
    answer({
      'health.getReport': {
        generatedAt: '', worst: 'error', counts: { ok: 1, warning: 2, error: 1 },
        checks: [check('a', 'warning'), check('b', 'ok'), check('c', 'error'), check('d', 'warning')],
      },
    });
    renderHome({ onOpenDiagnostics });
    expect(await screen.findByTestId('status-pill-overview-health-worst')).toHaveTextContent('Com erro');
    const shown = screen.getAllByTestId(/^overview-health-check-/).map((r) => r.getAttribute('data-testid'));
    expect(shown).toEqual(['overview-health-check-c', 'overview-health-check-a']);
    await user.click(screen.getByTestId('overview-open-diagnostics'));
    expect(onOpenDiagnostics).toHaveBeenCalled();
  });

  it('summarizes Global: personal instruction, counts and per-harness state', async () => {
    const entity = (name: string) => ({ urn: `urn:skill:${name}`, name });
    answer({
      'instruction.get': { urn: 'urn:instruction:default', name: 'default' },
      'skill.list': [entity('a'), entity('b')],
      'agent.list': [entity('c')],
      'mcp.list': [],
      'settings.get': { ui: { theme: 'light' }, adapters: { claude: { enabled: true }, cursor: { enabled: false }, lmstudio: { enabled: false } }, language: 'off' },
    });
    renderHome();
    await waitFor(() => expect(screen.getByTestId('overview-global-instruction')).toHaveTextContent('configurada'));
    await waitFor(() => expect(screen.getByTestId('overview-global-skills')).toHaveTextContent('2'));
    expect(screen.getByTestId('overview-global-agents')).toHaveTextContent('1');
    expect(screen.getByTestId('overview-global-mcp')).toHaveTextContent('0');
    expect(await screen.findByTestId('overview-harness-claude')).toHaveAttribute('data-enabled', 'true');
  });
});

describe('WorkspaceOverview', () => {
  const renderWorkspace = (props: Partial<React.ComponentProps<typeof WorkspaceOverview>> = {}) =>
    renderWithShell(
      <WorkspaceOverview
        workspace={ACME}
        visible
        onShowGit={vi.fn()}
        onNewSession={vi.fn()}
        onOpenSession={vi.fn()}
        onOpenInstruction={vi.fn()}
        onOpenTerminal={vi.fn()}
        onOpenLaunchPicker={vi.fn()}
        onError={vi.fn()}
        {...props}
      />,
    );

  it('summarizes git and links to the Git view', async () => {
    const user = userEvent.setup();
    const onShowGit = vi.fn();
    answer({
      'git.status': {
        isRepo: true, head: { name: 'main', oid: 'abc', upstream: 'origin/main', ahead: 2, behind: 1 },
        state: 'clean', files: [{ path: 'a', index: 'modified', worktree: 'unmodified', conflicted: false }], truncated: false,
      },
    });
    renderWorkspace({ onShowGit });
    expect(await screen.findByTestId('overview-git-branch')).toHaveTextContent('main');
    expect(screen.getByTestId('overview-git-changes')).toHaveTextContent('1 alteração(ões)');
    expect(screen.getByTestId('overview-git-changes')).toHaveTextContent('↑2 ↓1');
    await user.click(screen.getByTestId('overview-show-git'));
    expect(onShowGit).toHaveBeenCalled();
  });

  it('offers "Inicializar repositório" when the folder is not a repo', async () => {
    const user = userEvent.setup();
    answer({ 'git.status': { isRepo: false } });
    renderWorkspace();
    await user.click(await screen.findByTestId('overview-git-init'));
    await waitFor(() => expect(call).toHaveBeenCalledWith('git.init', {}));
  });

  it('starts a new session from the Sessões card', async () => {
    const user = userEvent.setup();
    const onNewSession = vi.fn();
    answer({});
    renderWorkspace({ onNewSession });
    await user.click(await screen.findByTestId('overview-new-session'));
    expect(onNewSession).toHaveBeenCalled();
    expect(call).toHaveBeenCalledWith('sessionHistory.stats', expect.objectContaining({ scope: { kind: 'workspace', workspaceId: 'w1' } }));
  });

  it('opens the workspace instruction, or offers to create one', async () => {
    const user = userEvent.setup();
    const onOpenInstruction = vi.fn();
    const instruction = {
      urn: 'urn:instruction:acme', kind: 'instruction', name: 'acme', description: '', scopes: ['workspace'], scopeId: 'w1',
      metadata: { version: '0.1.0', createdAt: '', updatedAt: '' }, source: { kind: 'workspace' }, content: 'a\nb\nc',
    };
    answer({ 'instruction.list': [instruction] });
    renderWorkspace({ onOpenInstruction });
    expect(await screen.findByTestId('overview-instruction-open')).toHaveTextContent('3 linhas');
    await user.click(screen.getByTestId('overview-instruction-open'));
    expect(onOpenInstruction).toHaveBeenCalledWith(instruction, false);
  });

  it('offers "Criar instruction" when the workspace has none', async () => {
    const user = userEvent.setup();
    const onOpenInstruction = vi.fn();
    answer({ 'instruction.list': [] });
    renderWorkspace({ onOpenInstruction });
    await user.click(await screen.findByTestId('overview-instruction-create'));
    expect(onOpenInstruction).toHaveBeenCalledWith(expect.objectContaining({ scopes: ['workspace'], scopeId: 'w1' }), true);
  });

  const sup = (name: string) => ({ name, type: 'node', request: 'launch', program: 'x', args: [], supported: true });
  const answerLaunch = (opts: { workspace?: Workspace; lists: Record<string, unknown>; terminals?: unknown[]; run?: unknown }) =>
    call.mockImplementation(async (method: string, params?: { folder?: string }) => {
      if (method === 'workspace.getActive') return ok(opts.workspace ?? ACME);
      if (method === 'launchConfig.list') return ok(opts.lists[params?.folder ?? ACME.rootPath] ?? null);
      if (method === 'terminal.list') return ok(opts.terminals ?? []);
      if (method === 'launchConfig.run') return ok(opts.run);
      return ok(undefined);
    });

  it('runs a supported launch config and opens its terminal', async () => {
    const user = userEvent.setup();
    const onOpenTerminal = vi.fn();
    const terminal = { terminalId: 'p1', workspaceId: 'w1', kind: 'launch', name: 'dev', relCwd: '', status: 'running', exitCode: null, generation: 0 };
    answerLaunch({
      lists: { '/repos/acme': { workspaceId: 'w1', configs: [sup('dev'), { ...sup('web'), type: 'chrome', supported: false }] } },
      run: terminal,
    });
    renderWorkspace({ onOpenTerminal });
    await user.click(await screen.findByTestId('overview-launch-run-dev'));
    await waitFor(() => expect(onOpenTerminal).toHaveBeenCalledWith(terminal));
    expect(call).toHaveBeenCalledWith('launchConfig.run', { configName: 'dev' });
    expect(screen.queryByTestId('overview-launch-run-web')).not.toBeInTheDocument();
  });

  it('caps the card at 5 and links to the picker; running and recent configs make the cut', async () => {
    const user = userEvent.setup();
    const onOpenLaunchPicker = vi.fn();
    localStorage.setItem('launch-recents:w1', JSON.stringify([{ folder: '/repos/acme', name: 'c6' }]));
    answerLaunch({
      lists: { '/repos/acme': { workspaceId: 'w1', configs: ['c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'c7'].map(sup) } },
      terminals: [{ terminalId: 't', workspaceId: 'w1', kind: 'launch', name: 'c7', folder: '/repos/acme', relCwd: '', status: 'running', exitCode: null, generation: 0 }],
    });
    renderWorkspace({ onOpenLaunchPicker });
    const see = await screen.findByTestId('overview-launch-see-all');
    expect(see).toHaveTextContent('Ver todas (7)…');
    const rows = screen.getAllByTestId(/^overview-launch-c\d$/);
    expect(rows).toHaveLength(5);
    expect(rows[0]).toHaveAttribute('data-testid', 'overview-launch-c7');
    expect(rows[1]).toHaveAttribute('data-testid', 'overview-launch-c6');
    await user.click(see);
    expect(onOpenLaunchPicker).toHaveBeenCalled();
  });

  it('has no "Ver todas" with 5 configs or fewer', async () => {
    answerLaunch({ lists: { '/repos/acme': { workspaceId: 'w1', configs: ['a', 'b', 'c', 'd', 'e'].map(sup) } } });
    renderWorkspace();
    await screen.findByTestId('overview-launch-a');
    expect(screen.queryByTestId('overview-launch-see-all')).not.toBeInTheDocument();
  });

  it('multi-folder: rows carry the folder tag and the run sends the folder', async () => {
    const user = userEvent.setup();
    const multi: Workspace = { ...ACME, extraFolders: ['/repos/api'] };
    answerLaunch({
      workspace: multi,
      lists: { '/repos/acme': { workspaceId: 'w1', configs: [sup('dev')] }, '/repos/api': { workspaceId: 'w1', configs: [sup('dev')] } },
      run: { terminalId: 'p', workspaceId: 'w1', kind: 'launch', name: 'dev', folder: '/repos/api', relCwd: '', status: 'running', exitCode: null, generation: 0 },
    });
    renderWorkspace({ workspace: multi });
    const row = await screen.findByTestId('overview-launch-dev-api');
    expect(row).toHaveTextContent('api');
    await user.click(screen.getByTestId('overview-launch-run-dev-api'));
    await waitFor(() => expect(call).toHaveBeenCalledWith('launchConfig.run', { configName: 'dev', folder: '/repos/api' }));
  });

  it('hides the Launch card when there are no configs', async () => {
    answer({ 'launchConfig.list': null });
    renderWorkspace();
    await screen.findByTestId('overview-card-git');
    expect(screen.queryByTestId('overview-card-launch')).not.toBeInTheDocument();
  });
});
