import { test } from '@playwright/test';
import { expect, type AppSession } from '../../fixtures/app.js';
import { launchShellApp, widthOf } from '../../fixtures/shell-app.js';

// Header (TopNav): history arrows, the command-palette button, and the two toggles that hide the side panels and
// hand their width to the Workbench.

let session: AppSession;
test.beforeAll(async () => {
  session = await launchShellApp();
});
test.afterAll(async () => {
  await session?.close();
});

test.describe('Shell › header', () => {
  test('Shows the history arrows, the palette button and both panel toggles, all panels open', async () => {
    const { page } = session;
    await expect(page.getByTestId('nav-history-forward')).toBeVisible();
    await expect(page.getByTestId('command-palette-trigger')).toBeVisible();
    await expect(page.getByTestId('workspace-toggle-files')).toHaveAttribute('data-collapsed', 'false');
    await expect(page.getByTestId('workspace-toggle-customizations')).toHaveAttribute('data-collapsed', 'false');
  });

  test('The palette button opens the command palette and Escape closes it', async () => {
    const { page } = session;
    await page.getByTestId('command-palette-trigger').click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toBeHidden();
  });

  for (const [toggle, panel, name] of [
    ['workspace-toggle-files', 'workspace-files-panel', 'Explorer'],
    ['workspace-toggle-customizations', 'workspace-customizations-aside', 'Control'],
  ] as const) {
    test(`The ${name} toggle collapses its panel to nothing, gives the width to the Workbench, and restores both`, async () => {
      const { page } = session;
      const canvasBefore = await widthOf(session, 'workbench-canvas-panel');
      
      const panelBefore = await widthOf(session, panel);
      expect(panelBefore).toBeGreaterThan(100);

      await page.getByTestId(toggle).click();
      await expect(page.getByTestId(toggle)).toHaveAttribute('data-collapsed', 'true');
      await expect(page.getByTestId(panel)).toHaveAttribute('data-collapsed', 'true');
      await expect.poll(() => widthOf(session, panel)).toBe(0);
      await expect.poll(() => widthOf(session, 'workbench-canvas-panel')).toBeGreaterThan(canvasBefore);

      await page.getByTestId(toggle).click();
      await expect(page.getByTestId(panel)).toHaveAttribute('data-collapsed', 'false');
      await expect.poll(() => widthOf(session, panel)).toBeGreaterThan(100);
      // Back within a few px of where it started (the panel re-opens at its remembered size, give or take the gap).
      await expect.poll(async () => Math.abs((await widthOf(session, 'workbench-canvas-panel')) - canvasBefore)).toBeLessThan(20);
    });
  }
});
