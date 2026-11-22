import { test } from '@playwright/test';
import { expect, type AppSession } from '../../fixtures/app.js';
import { launchShellApp } from '../../fixtures/shell-app.js';

// Explorer panel (left): the rail switches the view; the file tree opens files in the Workbench.

let session: AppSession;
test.beforeAll(async () => {
  session = await launchShellApp();
});
test.afterAll(async () => {
  await session?.close();
});

const VIEWS = [
  ['explorer-view-files', 'explorer-files-header'],
  ['explorer-view-git', 'git-head'],
  ['explorer-view-terminals', 'terminals-header'],
  ['explorer-view-browser', 'browser-header'],
  ['explorer-view-config', 'config-header'],
] as const;

test.describe('Shell › explorer panel', () => {
  test('The rail lists every view and the Git badge counts the uncommitted files', async () => {
    const { page } = session;
    for (const [rail] of VIEWS) await expect(page.getByTestId(rail)).toBeVisible();
    await expect(page.getByTestId('explorer-view-search')).toBeVisible();
    await expect(page.getByTestId('explorer-view-git')).toContainText('2');
  });

  for (const [rail, header] of VIEWS) {
    test(`Selecting ${rail.replace('explorer-view-', '')} on the rail shows that view`, async () => {
      const { page } = session;
      if (rail !== 'explorer-view-files') await page.getByTestId(rail).click(); // Arquivos is the view the panel opens on
      await expect(page.getByTestId(rail)).toHaveAttribute('aria-pressed', 'true');
      await expect(page.getByTestId(header).first()).toBeVisible();
    });
  }

  test('Clicking the active view on the rail collapses the panel, and the header toggle expands it again', async () => {
    const { page } = session;
    await page.getByTestId('explorer-view-files').click(); // the previous test left another view active: this only switches
    await expect(page.getByTestId('explorer-view-files')).toHaveAttribute('aria-pressed', 'true');
    await page.getByTestId('explorer-view-files').click();
    await expect(page.getByTestId('workspace-files-panel')).toHaveAttribute('data-collapsed', 'true');
    await page.getByTestId('workspace-toggle-files').click();
    await expect(page.getByTestId('workspace-files-panel')).toHaveAttribute('data-collapsed', 'false');
  });

  test('Clicking a file in the tree opens it in the Workbench', async () => {
    const { page } = session;
    // Arquivos is already the active view here; clicking it again would collapse the panel.
    await expect(page.getByTestId('explorer-view-files')).toHaveAttribute('aria-pressed', 'true');
    await page.getByTestId('folder-tree').getByText('README.md', { exact: true }).click();
    await expect(page.getByRole('button', { name: 'Fechar README.md' })).toBeVisible();
    await expect(page.getByText('Demo workspace for the e2e journeys.')).toBeVisible();
  });
});
