import { useMutation, useQueries, useQuery, useQueryClient, type UseQueryResult } from '@tanstack/react-query';
import { callIpc } from '../lib/ipc.js';
import { terminalsQueryKey } from './use-terminals.js';
import { useFolderRouting } from './use-folder-routing.js';
import type { LaunchEntry } from '../lib/launch-picker.js';
import type { WorkspaceLaunchConfigs } from '../../shared/launch-config.js';
import type { TerminalSnapshot } from '../../shared/terminal.js';

export const launchConfigsQueryKey = ['launchConfigs'] as const;

/** The open workspace's own launch.json configs — `null` at Início. */
export function useLaunchConfigs(enabled = true, folder?: string): UseQueryResult<WorkspaceLaunchConfigs | null> {
  return useQuery<WorkspaceLaunchConfigs | null>({
    queryKey: folder === undefined ? launchConfigsQueryKey : [...launchConfigsQueryKey, folder],
    queryFn: async () =>
      (await callIpc<WorkspaceLaunchConfigs | null>('launchConfig.list', folder === undefined ? undefined : { folder })) ?? null,
    enabled,
  });
}

/** Runs a configuration as a new terminal (two runs are two terminals) and resolves with its snapshot. */
export function useRunLaunchConfig() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (args: { configName: string; folder?: string }) => callIpc<TerminalSnapshot>('launchConfig.run', args),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: terminalsQueryKey }),
  });
}

export interface LaunchFolderError {
  folder: string;
  folderLabel: string;
  error: string;
}

export interface AllLaunchConfigs {
  entries: LaunchEntry[];
  errors: LaunchFolderError[];
  isLoading: boolean;
  /** At least one folder answered (not Início) — the launch entry points are meaningful. */
  active: boolean;
}

/** Every folder's launch.json of the open workspace, flattened. Single-folder keeps the unparameterised query. */
export function useAllLaunchConfigs(enabled = true): AllLaunchConfigs {
  const routing = useFolderRouting();
  const results = useQueries({
    queries: routing.folders.map((folder) => ({
      queryKey: routing.multi ? [...launchConfigsQueryKey, folder] : [...launchConfigsQueryKey],
      queryFn: async (): Promise<WorkspaceLaunchConfigs | null> =>
        (await callIpc<WorkspaceLaunchConfigs | null>('launchConfig.list', routing.multi ? { folder } : undefined)) ?? null,
      enabled,
    })),
  });
  const entries: LaunchEntry[] = [];
  const errors: LaunchFolderError[] = [];
  let active = false;
  routing.folders.forEach((folder, i) => {
    const data = results[i]?.data;
    if (data === null || data === undefined) return;
    active = true;
    const folderLabel = routing.multi ? routing.aliases[folder] ?? '' : '';
    if (data.error !== undefined) errors.push({ folder, folderLabel, error: data.error });
    for (const config of data.configs) entries.push({ folder, folderLabel, config });
  });
  return { entries, errors, isLoading: results.some((r) => r.isLoading), active };
}
