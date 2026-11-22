import { test } from '@playwright/test';
import { chmodSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { expect } from '../../fixtures/app.js';
import {
  launchCustomizationsApp,
  saveFromMenu,
  type CustomizationsApp,
} from '../../fixtures/customizations-app.js';

// Journey: saving a customization can fail. The tab must say why (validation → the rejected fields; io → a retryable
// toast), keep the unsaved edit, and recover once the cause is gone. Errors here are real: bad names go through the
// real validators, the io failure is a workspace folder the app cannot write to.

let session: CustomizationsApp;

test.beforeAll(async () => {
  session = await launchCustomizationsApp();
});
test.afterAll(async () => {
  // Leave the temp dir deletable even if a test died while it was read-only.
  try {
    chmodSync(join(session.acmeData, 'skills'), 0o755);
  } catch {
    // never created
  }
  await session?.close();
});

async function startSkill(name: string, description: string): Promise<void> {
  const { page } = session;
  await page.getByTestId('control-panel-new').click();
  await page.getByTestId('control-panel-new-skill').click();
  const modal = page.getByTestId('properties-modal');
  await expect(modal).toBeVisible();
  await modal.getByLabel('Name').fill(name);
  await modal.getByLabel('Description').fill(description);
  await modal.getByRole('button', { name: 'Fechar' }).click();
  await expect(modal).toBeHidden();
}

test.describe('Customizations › save errors', () => {
  test('A skill name that is not a valid id is rejected with the reason and nothing is written', async () => {
    const { page, app, acmeData } = session;
    await startSkill('Not A Valid Name!', 'Has spaces and punctuation');
    await saveFromMenu(app);

    const toast = page.getByTestId('toast').last();
    await expect(toast).toBeVisible();
    await expect(toast).toContainText(/validation|inválid|invalid/i);
    expect(existsSync(join(acmeData, 'skills', 'Not A Valid Name!'))).toBe(false);
  });

  test('A name already taken by another skill is refused instead of overwriting it', async () => {
    const { page, app, acmeData } = session;
    await startSkill('deploy-checklist', 'A second skill with the same name');
    await saveFromMenu(app);

    const toast = page.getByTestId('toast').last();
    await expect(toast).toHaveAttribute('data-variant', 'error');
    await expect(toast).not.toContainText('salvo');
    // The seeded skill keeps its own description on disk.
    const { readFileSync } = await import('node:fs');
    expect(readFileSync(join(acmeData, 'skills', 'deploy-checklist', 'SKILL.md'), 'utf8')).toContain(
      'description: Steps to ship acme-api',
    );
  });

  test('A workspace folder that cannot be written shows a retryable error, and Tentar de novo saves once it can', async () => {
    const { page, app, acmeData } = session;
    const skills = join(acmeData, 'skills');
    mkdirSync(skills, { recursive: true });
    chmodSync(skills, 0o555);

    await startSkill('write-tests', 'Write tests before code');
    await saveFromMenu(app);
    await expect(page.getByTestId('toast-action').last()).toHaveText('Tentar de novo');
    expect(existsSync(join(skills, 'write-tests'))).toBe(false);

    chmodSync(skills, 0o755);
    await page.getByTestId('toast-action').last().click();
    await expect.poll(() => existsSync(join(skills, 'write-tests', 'SKILL.md'))).toBe(true);
    await expect(page.getByTestId('tree-row-local::urn:skill:write-tests')).toBeVisible();
  });
});
