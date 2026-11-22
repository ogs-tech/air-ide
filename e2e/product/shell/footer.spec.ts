import { test } from '@playwright/test';
import { expect, type AppSession } from '../../fixtures/app.js';
import { launchShellApp } from '../../fixtures/shell-app.js';

// Footer (StatusBar): workspace switcher, git branch, diagnostics pill; it follows the Workbench and survives Início.

let session: AppSession;
test.beforeAll(async () => {
  session = await launchShellApp();
});
test.afterAll(async () => {
  await session?.close();
});

test.describe('Shell › footer', () => {
  test('Shows the workspace switcher, the branch and the diagnostics pill', async () => {
    const { page } = session;
    await expect(page.getByTestId('status-bar')).toBeVisible();
    await expect(page.getByTestId('context-switcher')).toContainText('acme-api');
    await expect(page.getByTestId('status-branch')).toHaveText('main');
    await expect(page.getByTestId('status-pill-sync')).toBeVisible();
  });

  test('The workspace switcher offers Início and opening another folder', async () => {
    const { page } = session;
    await page.getByTestId('context-switcher').click();
    await expect(page.getByTestId('context-switcher-home')).toBeVisible();
    await expect(page.getByTestId('context-switcher-open-folder')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('context-switcher-menu')).toBeHidden();
  });

  test('The diagnostics pill opens its popover', async () => {
    const { page } = session;
    await page.getByTestId('status-pill-sync').click();
    await expect(page.getByTestId('status-pill-sync')).toHaveAttribute('aria-expanded', 'true');
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('status-pill-sync')).toHaveAttribute('aria-expanded', 'false');
  });

  test('Going to Início keeps the footer, and picking the workspace again brings the branch back', async () => {
    const { page } = session;
    await page.getByTestId('context-switcher').click();
    await page.getByTestId('context-switcher-home').click();
    await expect(page.getByTestId('workspaces-list')).toBeVisible();
    await expect(page.getByTestId('status-bar')).toBeVisible();

    await page.locator('[data-testid^="workspace-list-row-"]').first().click();
    await expect(page.getByTestId('status-branch')).toHaveText('main');
  });
});
