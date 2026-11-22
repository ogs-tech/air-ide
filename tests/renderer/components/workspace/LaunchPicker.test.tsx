import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LaunchPicker } from '../../../../src/renderer/components/workspace/LaunchPicker.js';
import { mockApi, ok, fail, renderWithShell, type CallSpy } from '../../test-utils.js';
import type { TerminalSnapshot } from '../../../../src/shared/terminal.js';

const cfg = (name: string, supported = true) => ({
  name, type: supported ? 'node' : 'chrome', request: 'launch', program: 'i.js', args: [], supported,
});
const term = (over: Partial<TerminalSnapshot>): TerminalSnapshot => ({
  terminalId: 't1', workspaceId: 'w1', kind: 'launch', name: 'dev', folder: '/r/api', relCwd: '', status: 'running', exitCode: null, generation: 0, ...over,
});
const MULTI = { id: 'w1', name: 'W', rootPath: '/r/web', extraFolders: ['/r/api'], createdAt: '' };
const SINGLE = { id: 'w1', name: 'W', rootPath: '/r/web', createdAt: '' };

let call: CallSpy;
function answer(opts: { workspace?: unknown; terminals?: TerminalSnapshot[]; lists?: Record<string, unknown>; run?: unknown } = {}) {
  const lists = opts.lists ?? {
    '/r/web': { workspaceId: 'w1', configs: [cfg('dev'), cfg('storybook'), cfg('chrome', false)] },
    '/r/api': { workspaceId: 'w1', configs: [cfg('dev'), cfg('migrate')] },
  };
  call.mockImplementation(async (method: string, params?: { folder?: string }) => {
    if (method === 'workspace.getActive') return ok(opts.workspace ?? MULTI);
    if (method === 'terminal.list') return ok(opts.terminals ?? []);
    if (method === 'launchConfig.list') return ok(lists[params?.folder ?? '/r/web'] ?? null);
    if (method === 'launchConfig.run') return opts.run ?? ok(term({ terminalId: 'new' }));
    return ok(undefined);
  });
}
const props = () => ({ open: true, onClose: vi.fn(), onOpenTerminal: vi.fn(), onEditLaunchJson: vi.fn(), onError: vi.fn() });
const runCalls = () => call.mock.calls.filter(([m]) => m === 'launchConfig.run');

beforeEach(() => {
  localStorage.clear();
  call = mockApi();
});

describe('LaunchPicker', () => {
  it('lists configs of both folders with folder tags; single-folder shows none', async () => {
    answer();
    const { unmount } = renderWithShell(<LaunchPicker {...props()} />);
    const row = await screen.findByTestId('launch-picker-row-api-dev');
    expect(row).toHaveTextContent('api');
    expect(screen.getByTestId('launch-picker-row-web-dev')).toHaveTextContent('web');
    unmount();
    answer({ workspace: SINGLE });
    renderWithShell(<LaunchPicker {...props()} />);
    const single = await screen.findByTestId('launch-picker-row-root-dev');
    expect(single).not.toHaveTextContent('web');
  });

  it('filters by folder label and ranks name prefix first', async () => {
    answer();
    renderWithShell(<LaunchPicker {...props()} />);
    const search = await screen.findByTestId('launch-picker-search');
    await screen.findByTestId('launch-picker-row-api-dev');
    await userEvent.type(search, 'api');
    expect(screen.queryByTestId('launch-picker-row-web-dev')).not.toBeInTheDocument();
    expect(screen.getByTestId('launch-picker-row-api-migrate')).toBeInTheDocument();
    await userEvent.clear(search);
    await userEvent.type(search, 'de');
    const rows = screen.getAllByRole('option');
    expect(rows.every((r) => r.textContent?.startsWith('dev'))).toBe(true);
  });

  it('marks only the row of the folder that is running (same name in two folders)', async () => {
    answer({ terminals: [term({})] });
    renderWithShell(<LaunchPicker {...props()} />);
    await screen.findByTestId('launch-picker-running-api-dev');
    expect(screen.queryByTestId('launch-picker-running-web-dev')).not.toBeInTheDocument();
  });

  it('⏎ on a running row focuses its terminal without running; ⇧⏎ starts another', async () => {
    answer({ terminals: [term({})] });
    const p = props();
    renderWithShell(<LaunchPicker {...p} />);
    await screen.findByTestId('launch-picker-running-api-dev');
    await userEvent.keyboard('{Enter}');
    expect(p.onOpenTerminal).toHaveBeenCalledWith(expect.objectContaining({ terminalId: 't1' }));
    expect(runCalls()).toHaveLength(0);
    await userEvent.keyboard('{Shift>}{Enter}{/Shift}');
    await waitFor(() => expect(runCalls()).toHaveLength(1));
    expect(runCalls()[0]?.[1]).toEqual({ configName: 'dev', folder: '/r/api' });
  });

  it('an exited terminal is not "rodando" and ⏎ starts a fresh run', async () => {
    answer({ terminals: [term({ status: 'exited', exitCode: 0 })] });
    const p = props();
    renderWithShell(<LaunchPicker {...p} />);
    await screen.findByTestId('launch-picker-row-api-dev');
    expect(screen.queryByTestId('launch-picker-running-api-dev')).not.toBeInTheDocument();
    await userEvent.type(screen.getByTestId('launch-picker-search'), 'migrate');
    await userEvent.clear(screen.getByTestId('launch-picker-search'));
    await userEvent.type(screen.getByTestId('launch-picker-search'), 'dev');
    await userEvent.hover(screen.getByTestId('launch-picker-row-api-dev'));
    await userEvent.keyboard('{Enter}');
    await waitFor(() => expect(runCalls()).toHaveLength(1));
    expect(runCalls()[0]?.[1]).toEqual({ configName: 'dev', folder: '/r/api' });
  });

  it('hides unsupported configs until the footer toggle, then shows them disabled', async () => {
    answer();
    renderWithShell(<LaunchPicker {...props()} />);
    await screen.findByTestId('launch-picker-row-api-dev');
    expect(screen.queryByTestId('launch-picker-row-web-chrome')).not.toBeInTheDocument();
    const toggle = screen.getByTestId('launch-picker-toggle-unsupported');
    expect(toggle).toHaveTextContent('Mostrar não suportadas (1)');
    await userEvent.click(toggle);
    expect(screen.getByTestId('launch-picker-row-web-chrome')).toHaveAttribute('aria-disabled', 'true');
    await userEvent.click(screen.getByTestId('launch-picker-row-web-chrome'));
    expect(runCalls()).toHaveLength(0);
  });

  it('shows a malformed folder as one line while the other folder still lists', async () => {
    answer({ lists: { '/r/web': { workspaceId: 'w1', configs: [], error: 'unexpected token' }, '/r/api': { workspaceId: 'w1', configs: [cfg('dev')] } } });
    renderWithShell(<LaunchPicker {...props()} />);
    expect(await screen.findByTestId('launch-picker-error-web')).toHaveTextContent('web: launch.json inválido — unexpected token');
    expect(screen.getByTestId('launch-picker-row-api-dev')).toBeInTheDocument();
  });

  it('shows the empty state when every folder is empty', async () => {
    answer({ lists: { '/r/web': { workspaceId: 'w1', configs: [] }, '/r/api': { workspaceId: 'w1', configs: [] } } });
    renderWithShell(<LaunchPicker {...props()} />);
    expect(await screen.findByTestId('launch-picker-empty')).toBeInTheDocument();
  });

  it('a successful run stores a recent that leads the list next time', async () => {
    answer();
    const p = props();
    const { unmount } = renderWithShell(<LaunchPicker {...p} />);
    await userEvent.click(await screen.findByTestId('launch-picker-row-api-migrate'));
    await waitFor(() => expect(p.onClose).toHaveBeenCalled());
    expect(JSON.parse(localStorage.getItem('launch-recents:w1') ?? '[]')).toEqual([{ folder: '/r/api', name: 'migrate' }]);
    unmount();
    renderWithShell(<LaunchPicker {...props()} />);
    await screen.findByTestId('launch-picker-row-api-migrate');
    expect(screen.getAllByRole('option')[0]).toHaveTextContent('migrate');
  });

  it('a failed run reports the error and keeps the dialog open', async () => {
    answer({ run: fail('internal', 'boom') });
    const p = props();
    renderWithShell(<LaunchPicker {...p} />);
    await userEvent.click(await screen.findByTestId('launch-picker-row-api-dev'));
    await waitFor(() => expect(p.onError).toHaveBeenCalledWith('boom'));
    expect(p.onClose).not.toHaveBeenCalled();
  });

  it('Editar launch.json passes the highlighted row folder', async () => {
    answer();
    const p = props();
    renderWithShell(<LaunchPicker {...p} />);
    await screen.findByTestId('launch-picker-row-web-dev');
    await userEvent.click(screen.getByTestId('launch-picker-edit'));
    expect(p.onEditLaunchJson).toHaveBeenCalledWith('/r/web');
  });
});
