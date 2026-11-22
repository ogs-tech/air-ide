import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { mockApi, ok, makeTestQueryClient, type CallSpy } from '../test-utils.js';
import { useAllLaunchConfigs, useLaunchConfigs } from '../../../src/renderer/hooks/use-launch-configs.js';
import type { WorkspaceLaunchConfigs } from '../../../src/shared/launch-config.js';

const wrapper = ({ children }: { children: React.ReactNode }) => {
  const client = makeTestQueryClient();
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
};

let call: CallSpy;
beforeEach(() => {
  call = mockApi();
});

describe('useLaunchConfigs', () => {
  it("returns the open workspace's launch configs", async () => {
    const entry: WorkspaceLaunchConfigs = {
      workspaceId: 'w1',
      configs: [{ name: 'Run', type: 'node', request: 'launch', program: 'index.js', args: [], supported: true }],
    };
    call.mockImplementation(async (method: string) => (method === 'launchConfig.list' ? ok(entry) : ok(undefined)));
    const { result } = renderHook(() => useLaunchConfigs(), { wrapper });
    await waitFor(() => expect(result.current.data).toEqual(entry));
  });

  it('returns null at Início', async () => {
    call.mockImplementation(async (method: string) => (method === 'launchConfig.list' ? ok(null) : ok(undefined)));
    const { result } = renderHook(() => useLaunchConfigs(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBeNull();
  });
});

describe('useAllLaunchConfigs', () => {
  const cfg = (name: string) => ({ name, type: 'node', request: 'launch', program: 'i.js', args: [], supported: true });
  const ws = (extra?: string[]) => ({ id: 'w1', name: 'W', rootPath: '/r/web', createdAt: '', ...(extra ? { extraFolders: extra } : {}) });

  it('single folder: lists without params and no folder label', async () => {
    call.mockImplementation(async (method: string) =>
      method === 'workspace.getActive' ? ok(ws()) : method === 'launchConfig.list' ? ok({ workspaceId: 'w1', configs: [cfg('dev')] }) : ok(undefined),
    );
    const { result } = renderHook(() => useAllLaunchConfigs(), { wrapper });
    await waitFor(() => expect(result.current.entries).toHaveLength(1));
    expect(result.current.entries[0]).toMatchObject({ folder: '/r/web', folderLabel: '' });
    expect(call).toHaveBeenCalledWith('launchConfig.list', {});
    expect(result.current.active).toBe(true);
  });

  it('multi folder: one list per folder, flattened, errors reported per folder', async () => {
    call.mockImplementation(async (method: string, params?: { folder?: string }) => {
      if (method === 'workspace.getActive') return ok(ws(['/r/api']));
      if (method === 'launchConfig.list')
        return ok(params?.folder === '/r/api' ? { workspaceId: 'w1', configs: [], error: 'boom' } : { workspaceId: 'w1', configs: [cfg('dev')] });
      return ok(undefined);
    });
    const { result } = renderHook(() => useAllLaunchConfigs(), { wrapper });
    await waitFor(() => expect(result.current.errors).toHaveLength(1));
    expect(call).toHaveBeenCalledWith('launchConfig.list', { folder: '/r/api' });
    expect(call).toHaveBeenCalledWith('launchConfig.list', { folder: '/r/web' });
    expect(result.current.errors[0]).toMatchObject({ folder: '/r/api', error: 'boom' });
    expect(result.current.entries.map((e) => e.config.name)).toEqual(['dev']);
    expect(result.current.entries[0]?.folderLabel).not.toBe('');
  });

  it('is inactive when every folder answers null (Início)', async () => {
    call.mockImplementation(async (method: string) => (method === 'workspace.getActive' ? ok(ws()) : ok(null)));
    const { result } = renderHook(() => useAllLaunchConfigs(), { wrapper });
    await waitFor(() => expect(call).toHaveBeenCalledWith('launchConfig.list', {}));
    expect(result.current.active).toBe(false);
    expect(result.current.entries).toEqual([]);
  });
});
