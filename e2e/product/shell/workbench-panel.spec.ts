import { test } from '@playwright/test';
import { expect, type AppSession } from '../../fixtures/app.js';
import { launchShellApp } from '../../fixtures/shell-app.js';

// Workbench (centre): tab strip, breadcrumb of the active file, the "+" menu, and what is left when the last tab closes.
// Session tabs live in e2e/product/sessions/workbench*.spec.ts.

let session: AppSession;
test.beforeAll(async () => {
  session = await launchShellApp();
});
test.afterAll(async () => {
  await session?.close();
});

test.describe('Shell › workbench', () => {
  test('Opening files adds tabs, the active tab owns the breadcrumb, and closing it returns to the overview', async () => {
    const { page } = session;
    const tree = page.getByTestId('folder-tree');

    await tree.getByText('README.md', { exact: true }).click();
    await expect(page.getByRole('button', { name: 'Fechar README.md' })).toBeVisible();
    await expect(page.getByTestId('workbench-breadcrumb')).toContainText('README.md');

    await tree.getByText('package.json', { exact: true }).click();
    await expect(page.getByRole('button', { name: 'Fechar package.json' })).toBeVisible();
    await expect(page.getByTestId('workbench-breadcrumb')).toContainText('package.json');

    await page.getByRole('button', { name: 'Fechar package.json' }).click();
    await expect(page.getByTestId('workbench-breadcrumb')).toContainText('README.md');
    await page.getByRole('button', { name: 'Fechar README.md' }).click();
    await expect(page.getByTestId('workbench-breadcrumb')).toBeHidden();
    await expect(page.getByTestId('workbench-canvas')).toBeVisible();
  });

  test('The + button offers the new-tab menu and Escape dismisses it', async () => {
    const { page } = session;
    await page.getByTestId('workbench-new').click();
    await expect(page.getByRole('menu')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('menu')).toBeHidden();
  });
});
