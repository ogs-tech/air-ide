import { test } from '@playwright/test';
import { join } from 'node:path';
import {
  expect,
  launchApp,
  seedGitWorkspace,
  seedWorkspaceRegistry,
  writeFile,
  type AppSession,
} from '../../fixtures/app.js';

// Journey: many open tabs. The strip shrinks inactive tabs instead of pushing them out, keeps the active one fully
// labelled, and the switcher (search, grouped) reaches any tab, hidden or not.

const FILE_COUNT = 40;
const fileName = (n: number): string => `notes-${String(n).padStart(2, '0')}.txt`;

let session: AppSession;
const tabOf = (id: string) => session.page.getByTestId(`workbench-tab-session:${id}`);

test.beforeAll(async () => {
  session = await launchApp({
    cli: { claude: { signedIn: true, interactive: true } },
    seed: (home) => {
      const root = join(home, 'Projects', 'acme-api');
      seedGitWorkspace(root);
      for (let n = 1; n <= FILE_COUNT; n += 1) writeFile(join(root, fileName(n)), `note ${n}\n`);
      seedWorkspaceRegistry(home, [{ id: 'acme', name: 'acme-api', rootPath: root }], 'acme');
    },
  });
});

test.afterAll(async () => {
  await session?.close();
});

const openNote = async (n: number): Promise<void> => {
  await session.page.getByTestId('folder-tree').getByText(fileName(n), { exact: true }).click();
  await expect(session.page.locator('[data-testid^="workbench-tab-"][data-active="true"]')).toContainText(fileName(n));
};

const stripFits = (): Promise<boolean> =>
  session.page.getByTestId('workbench-tabs').evaluate((el) => el.scrollWidth <= el.clientWidth + 1);

test.describe('Sessions › many tabs', () => {
  test('A session tab keeps its state dot and real title while files pile up around it', async () => {
    const { page } = session;
    const before = (await session.call<{ sessionId: string }[]>('session.list')).map((s) => s.sessionId);
    await page.getByTestId('workspace-sessions-new').click();
    await expect
      .poll(async () => (await session.call<{ sessionId: string }[]>('session.list')).filter((s) => !before.includes(s.sessionId)).length)
      .toBe(1);
    const created = (await session.call<{ sessionId: string }[]>('session.list')).find((s) => !before.includes(s.sessionId))!;
    await expect.poll(async () => (await session.call<{ sessionId: string; activity?: string }[]>('session.list')).find((s) => s.sessionId === created.sessionId)?.activity).toBe('idle');
    // A first prompt gives the row (and the tab) a real title instead of "Untitled".
    await session.call('session.write', { sessionId: created.sessionId, data: 'Refactor billing\r' });
    await expect(page.getByTestId(`tree-session-${created.sessionId}`)).toContainText('Refactor billing', { timeout: 15_000 });
    await expect(tabOf(created.sessionId)).toContainText('Refactor billing', { timeout: 15_000 });
    await expect(tabOf(created.sessionId)).not.toContainText('Untitled');
    await expect(page.getByTestId(`workbench-tab-state-session:${created.sessionId}`)).toBeVisible();

    for (let n = 1; n <= 12; n += 1) await openNote(n);
    expect(await stripFits()).toBe(true);
    // The tab in front keeps its whole label.
    const activeLabel = page.locator('[data-testid^="workbench-tab-"][data-active="true"] p').first();
    expect(await activeLabel.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
    // The session stayed reachable and kept its dot while shrunk.
    await expect(page.getByTestId(`workbench-tab-state-session:${created.sessionId}`)).toBeVisible();
  });

  test('With 40 tabs the switcher finds a hidden one by name and brings it to the front', async () => {
    const { page } = session;
    for (let n = 13; n <= FILE_COUNT; n += 1) await openNote(n);

    await page.getByTestId('workbench-all-tabs').click();
    await page.getByTestId('workbench-switcher-filter').fill('notes-03');
    await page.locator('[data-testid^="workbench-all-tabs-"][data-testid$="notes-03.txt"]').click();

    const active = page.locator('[data-testid^="workbench-tab-"][data-active="true"]');
    await expect(active).toContainText('notes-03.txt');
    await expect(active).toBeInViewport();
  });
});
