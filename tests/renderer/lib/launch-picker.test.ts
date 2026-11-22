import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  dropStaleRecents,
  isRunning,
  pushLaunchRecent,
  rankLaunchEntries,
  readLaunchRecents,
  type LaunchEntry,
} from '../../../src/renderer/lib/launch-picker.js';
import type { TerminalSnapshot } from '../../../src/shared/terminal.js';

const entry = (name: string, folder = '/r/api', folderLabel = 'api'): LaunchEntry => ({
  folder,
  folderLabel,
  config: { name, type: 'node', request: 'launch', program: 'x.js', args: [], supported: true },
});
const term = (over: Partial<TerminalSnapshot>): TerminalSnapshot => ({
  terminalId: 't', workspaceId: 'w', kind: 'launch', name: 'dev', folder: '/r/api', relCwd: '', status: 'running', exitCode: null, generation: 0, ...over,
});
const names = (list: LaunchEntry[]) => list.map((e) => `${e.folderLabel}:${e.config.name}`);

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});

describe('isRunning', () => {
  it('matches folder + name of a running launch terminal', () => {
    const t = term({});
    expect(isRunning(entry('dev'), [t])).toBe(t);
  });
  it('ignores the same name in another folder, exited terminals and shells', () => {
    expect(isRunning(entry('dev', '/r/web', 'web'), [term({})])).toBeUndefined();
    expect(isRunning(entry('dev'), [term({ status: 'exited' })])).toBeUndefined();
    expect(isRunning(entry('dev'), [term({ kind: 'shell' })])).toBeUndefined();
  });
});

describe('rankLaunchEntries', () => {
  it('orders an empty query as running, recents, rest', () => {
    const entries = [entry('a'), entry('b'), entry('c'), entry('d')];
    const out = rankLaunchEntries(entries, '', [term({ name: 'd' })], [{ folder: '/r/api', name: 'c' }]);
    expect(names(out)).toEqual(['api:d', 'api:c', 'api:a', 'api:b']);
  });
  it('ranks name prefix, then substring, then folder label; drops non-matches', () => {
    const entries = [entry('x', '/r/design', 'design'), entry('my-dev'), entry('dev'), entry('other')];
    expect(names(rankLaunchEntries(entries, 'de', [], []))).toEqual(['api:dev', 'api:my-dev', 'design:x']);
  });
  it('breaks ties by recents', () => {
    const entries = [entry('dev1'), entry('dev2')];
    expect(names(rankLaunchEntries(entries, 'dev', [], [{ folder: '/r/api', name: 'dev2' }]))).toEqual(['api:dev2', 'api:dev1']);
  });
});

describe('recents storage', () => {
  it('returns [] when storage throws or holds garbage, keeps valid items of a bad shape', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(readLaunchRecents('w')).toEqual([]);
    vi.restoreAllMocks();
    localStorage.setItem('launch-recents:w', '{nope');
    expect(readLaunchRecents('w')).toEqual([]);
    localStorage.setItem('launch-recents:w', JSON.stringify([{ folder: '/a', name: 'x' }, { folder: 1 }, 'str']));
    expect(readLaunchRecents('w')).toEqual([{ folder: '/a', name: 'x' }]);
  });
  it('dedupes, puts newest first and caps at 8', () => {
    for (let i = 0; i < 10; i++) pushLaunchRecent('w', { folder: '/a', name: `n${i}` });
    pushLaunchRecent('w', { folder: '/a', name: 'n5' });
    const out = readLaunchRecents('w');
    expect(out).toHaveLength(8);
    expect(out[0]).toEqual({ folder: '/a', name: 'n5' });
    expect(out.filter((r) => r.name === 'n5')).toHaveLength(1);
  });
  it('does not throw when setItem throws', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });
    expect(() => pushLaunchRecent('w', { folder: '/a', name: 'x' })).not.toThrow();
  });
});

describe('dropStaleRecents', () => {
  it('removes recents whose folder+name is gone', () => {
    const out = dropStaleRecents([{ folder: '/r/api', name: 'dev' }, { folder: '/r/api', name: 'old' }], [entry('dev')]);
    expect(out).toEqual([{ folder: '/r/api', name: 'dev' }]);
  });
});
