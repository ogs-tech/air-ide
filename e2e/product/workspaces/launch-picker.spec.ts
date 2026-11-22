import { test } from '@playwright/test';
import { join } from 'node:path';
import { expect, launchApp, seedWorkspaceRegistry, writeFile, type AppSession } from '../../fixtures/app.js';

// Journey: a workspace with two folders, each with its own launch.json (both have a `dev`) → open the launch
// picker from Terminais ＋▾ → find a config by folder → run it → see "rodando" on that folder's row only →
// ⏎ focuses the live tab instead of starting a duplicate → unsupported entries behind the footer toggle →
// Início hides the entry and the picker works again after coming back.

let session: AppSession;

const serverJs = (label: string): string =>
  `console.log('${label} up');\nsetInterval(() => {}, 1000);\n`;

const launchJson = (extra: object[] = []): string =>
  JSON.stringify({
    version: '0.2.0',
    configurations: [
      { name: 'dev', type: 'node', request: 'launch', program: '${workspaceFolder}/server.js' },
      ...extra,
    ],
  });

test.beforeAll(async () => {
  session = await launchApp({
    seed: (home) => {
      const web = join(home, 'Projects', 'web');
      const api = join(home, 'Projects', 'api');
      writeFile(join(web, 'server.js'), serverJs('web'));
      writeFile(join(web, '.vscode', 'launch.json'), launchJson([{ name: 'storybook', type: 'node', request: 'launch', program: '${workspaceFolder}/server.js' }]));
      writeFile(join(api, 'server.js'), serverJs('api'));
      writeFile(join(api, '.vscode', 'launch.json'), launchJson([{ name: 'inspector', type: 'chrome', request: 'launch', url: 'http://localhost:3000' }]));
      seedWorkspaceRegistry(home, [{ id: 'shop', name: 'shop', rootPath: web, extraFolders: [api] }], 'shop');
    },
  });
});

test.afterAll(async () => {
  await session?.close();
});

test.describe('Workspaces › launch picker', () => {
  test('Finding, running and refocusing configurations across two folders', async () => {
    const { page } = session;
    const terminalTabs = page.locator('[data-testid^="workbench-tab-terminal:"]');
    await page.getByTestId('explorer-view-terminals').click();

    await test.step('＋▾ → "Executar configuração…" lists both folders with their tags', async () => {
      await page.getByTestId('terminals-new-menu').click();
      await page.getByTestId('terminals-menu-open-launch-picker').click();
      await expect(page.getByTestId('launch-picker')).toBeVisible();
      await expect(page.getByTestId('launch-picker-row-web-dev')).toContainText('web');
      await expect(page.getByTestId('launch-picker-row-api-dev')).toContainText('api');
      await expect(page.getByTestId('launch-picker-row-web-storybook')).toBeVisible();
    });

    await test.step('typing the folder name narrows the list to it', async () => {
      await page.getByTestId('launch-picker-search').fill('api');
      await expect(page.getByTestId('launch-picker-row-api-dev')).toBeVisible();
      await expect(page.getByTestId('launch-picker-row-web-dev')).toHaveCount(0);
    });

    await test.step('running api › dev opens its terminal as the active tab', async () => {
      await page.getByTestId('launch-picker-row-api-dev').click();
      await expect(page.getByTestId('launch-picker')).toHaveCount(0);
      await expect(terminalTabs).toHaveCount(1);
      await expect(terminalTabs.first()).toHaveAttribute('aria-pressed', 'true');
      await expect(page.locator('.xterm-rows').first()).toContainText('api up', { timeout: 15_000 });
    });

    await test.step('reopening shows "rodando" on api › dev only, and it is listed first', async () => {
      await page.getByTestId('terminals-new-menu').click();
      await page.getByTestId('terminals-menu-open-launch-picker').click();
      await expect(page.getByTestId('launch-picker-running-api-dev')).toBeVisible();
      await expect(page.getByTestId('launch-picker-running-web-dev')).toHaveCount(0);
      await expect(page.getByRole('option').first()).toContainText('api');
    });

    await test.step('⏎ on the running row focuses its tab instead of starting a duplicate', async () => {
      await page.keyboard.press('Enter');
      await expect(page.getByTestId('launch-picker')).toHaveCount(0);
      await expect(terminalTabs).toHaveCount(1);
    });

    await test.step('unsupported entries stay behind the footer toggle, disabled', async () => {
      await page.getByTestId('terminals-new-menu').click();
      await page.getByTestId('terminals-menu-open-launch-picker').click();
      await expect(page.getByTestId('launch-picker-row-api-inspector')).toHaveCount(0);
      const toggle = page.getByTestId('launch-picker-toggle-unsupported');
      await expect(toggle).toHaveText('Mostrar não suportadas (1)');
      await toggle.click();
      await expect(page.getByTestId('launch-picker-row-api-inspector')).toHaveAttribute('aria-disabled', 'true');
      await page.keyboard.press('Escape');
      await expect(page.getByTestId('launch-picker')).toHaveCount(0);
    });

    await test.step('Início has no Terminais entry; back in the workspace the picker works again', async () => {
      // Leaving the workspace ends its terminals; stop the live one first so no confirmation is in the way.
      await page.locator('[data-testid^="terminal-stop-"]').first().click();
      await page.getByTestId('context-switcher').click();
      await page.getByTestId('context-switcher-home').click();
      await expect(page.getByTestId('workspaces-list')).toBeVisible();
      await expect(page.getByTestId('explorer-view-terminals')).toHaveCount(0);
      await page.locator('[data-testid^="workspace-list-row-"]').first().click();
      await expect(page.getByTestId('workspace-screen')).toBeVisible();
      // Coming back, the left panel can start collapsed on the view it last showed.
      const showLeft = page.getByRole('button', { name: 'Mostrar painel esquerdo' });
      await expect(page.getByTestId('terminals-section').or(showLeft)).toBeVisible();
      if (await showLeft.isVisible()) await showLeft.click();
      await expect(page.getByTestId('terminals-section')).toBeVisible();
      await page.getByTestId('terminals-new-menu').click();
      await page.getByTestId('terminals-menu-open-launch-picker').click();
      await expect(page.getByTestId('launch-picker-row-web-dev')).toBeVisible();
    });
  });
});
