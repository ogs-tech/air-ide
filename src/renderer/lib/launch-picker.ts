import type { LaunchConfig } from '../../shared/launch-config.js';
import type { TerminalSnapshot } from '../../shared/terminal.js';

export interface LaunchEntry {
  /** Absolute workspace folder that owns the `launch.json`. */
  folder: string;
  /** Folder alias in a multi-folder workspace; `''` in a single-folder one (no tag shown). */
  folderLabel: string;
  config: LaunchConfig;
}

export interface LaunchRecent {
  folder: string;
  name: string;
}

const MAX_RECENTS = 8;
const recentsKey = (workspaceId: string): string => `launch-recents:${workspaceId}`;

/** The live launch terminal of this exact config (`folder` + `name`, never `name` alone), if any. */
export function isRunning(entry: LaunchEntry, terminals: readonly TerminalSnapshot[]): TerminalSnapshot | undefined {
  return terminals.find(
    (t) => t.kind === 'launch' && t.status === 'running' && t.name === entry.config.name && t.folder === entry.folder,
  );
}

const sameEntry = (a: LaunchRecent, b: LaunchRecent): boolean => a.folder === b.folder && a.name === b.name;

function recentRank(entry: LaunchEntry, recents: readonly LaunchRecent[]): number {
  const index = recents.findIndex((r) => sameEntry(r, { folder: entry.folder, name: entry.config.name }));
  return index === -1 ? Number.POSITIVE_INFINITY : index;
}

function matchScore(entry: LaunchEntry, needle: string): number {
  const name = entry.config.name.toLowerCase();
  if (name.startsWith(needle)) return 0;
  if (name.includes(needle)) return 1;
  if (entry.folderLabel.toLowerCase().includes(needle)) return 2;
  return -1;
}

/** Orders entries for display: see the launch-picker spec. Stable — input order is the last tiebreaker. */
export function rankLaunchEntries(
  entries: readonly LaunchEntry[],
  query: string,
  terminals: readonly TerminalSnapshot[],
  recents: readonly LaunchRecent[],
): LaunchEntry[] {
  const needle = query.trim().toLowerCase();
  const indexed = entries.map((entry, index) => ({ entry, index }));
  if (needle === '') {
    const tier = (e: LaunchEntry): number => (isRunning(e, terminals) ? 0 : recentRank(e, recents) < Infinity ? 1 : 2);
    return indexed
      .sort((a, b) => tier(a.entry) - tier(b.entry) || (tier(a.entry) === 1 ? recentRank(a.entry, recents) - recentRank(b.entry, recents) : 0) || a.index - b.index)
      .map((x) => x.entry);
  }
  return indexed
    .map((x) => ({ ...x, score: matchScore(x.entry, needle) }))
    .filter((x) => x.score >= 0)
    .sort((a, b) => a.score - b.score || recentRank(a.entry, recents) - recentRank(b.entry, recents) || a.index - b.index)
    .map((x) => x.entry);
}

const isRecent = (value: unknown): value is LaunchRecent =>
  typeof value === 'object' && value !== null && typeof (value as LaunchRecent).folder === 'string' && typeof (value as LaunchRecent).name === 'string';

/** Recents of a workspace, newest first. Never throws: storage can be blocked or hold garbage. */
export function readLaunchRecents(workspaceId: string): LaunchRecent[] {
  try {
    const raw = localStorage.getItem(recentsKey(workspaceId));
    if (raw === null) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isRecent).map(({ folder, name }) => ({ folder, name })).slice(0, MAX_RECENTS);
  } catch {
    return [];
  }
}

export function pushLaunchRecent(workspaceId: string, recent: LaunchRecent): void {
  try {
    const next = [recent, ...readLaunchRecents(workspaceId).filter((r) => !sameEntry(r, recent))].slice(0, MAX_RECENTS);
    localStorage.setItem(recentsKey(workspaceId), JSON.stringify(next));
  } catch {
    // Recents are a convenience; the picker works without them.
  }
}

/** Drops recents whose config (or folder) no longer exists — never render a ghost row. */
export function dropStaleRecents(recents: readonly LaunchRecent[], entries: readonly LaunchEntry[]): LaunchRecent[] {
  return recents.filter((r) => entries.some((e) => sameEntry(r, { folder: e.folder, name: e.config.name })));
}
