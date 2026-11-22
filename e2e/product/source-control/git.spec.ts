import { test } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import {
  expect,
  launchApp,
  seedGitWorkspace,
  seedWorkspaceRegistry,
  writeFile,
  type AppSession,
} from '../../fixtures/app.js';

// Journey: open the Git view of a workspace, stage, commit and see the tree go clean. The error half covers the git
// failures a person can actually hit without a network: a pre-commit hook that refuses, a branch with nowhere to
// push, and a folder that is not a repository yet. Remotes and credentials (auth / external_api) are not driven here.

interface GitApp extends AppSession {
  root: string;
}

async function launchGit(setup: (root: string) => void): Promise<GitApp> {
  let root = '';
  const session = await launchApp({
    seed: (home) => {
      root = join(home, 'Projects', 'acme-api');
      setup(root);
      seedWorkspaceRegistry(home, [{ id: 'acme', name: 'acme-api', rootPath: root }], 'acme');
    },
  });
  await session.page.getByTestId('explorer-view-git').click();
  return Object.assign(session, { root });
}

const gitLog = (root: string): string =>
  execFileSync('git', ['log', '--format=%s'], { cwd: root, encoding: 'utf8' });

test.describe('Source control › git repository', () => {
  let session: GitApp;
  test.beforeAll(async () => {
    session = await launchGit(seedGitWorkspace);
  });
  test.afterAll(async () => {
    await session?.close();
  });

  test('Staging the changes and committing leaves a clean tree and a new commit', async () => {
    const { page, root } = session;

    await test.step('the Git view lists the uncommitted files as changes', async () => {
      await expect(page.getByTestId('git-changes-list')).toBeVisible();
      await expect(page.getByTestId('git-change-changes-src/routes.js')).toBeVisible();
      await expect(page.getByTestId('git-change-changes-src/index.js')).toBeVisible();
    });

    await test.step('staging a file moves it to the Staged group', async () => {
      await page.getByTestId('git-change-changes-src/routes.js').hover();
      await page.getByTestId('git-change-changes-src/routes.js-stage').click();
      await expect(page.getByTestId('git-change-staged-src/routes.js')).toBeVisible();
    });

    await test.step('Commit asks for a message and records only the staged file', async () => {
      await page.getByTestId('git-commit-open').click();
      await page.getByTestId('git-commit-message').fill('Add routes');
      await page.getByTestId('git-commit-btn').click();
      await expect.poll(() => gitLog(root)).toContain('Add routes');
      await expect(page.getByTestId('git-change-staged-src/routes.js')).toBeHidden();
      await expect(page.getByTestId('git-change-changes-src/index.js')).toBeVisible();
    });

    await test.step('staging everything and committing again empties the list', async () => {
      await page.getByTestId('git-stage-all').click();
      await page.getByTestId('git-commit-open').click();
      await page.getByTestId('git-commit-message').fill('Log the port');
      await page.getByTestId('git-commit-btn').click();
      await expect(page.getByTestId('git-clean')).toBeVisible();
      expect(gitLog(root)).toContain('Log the port');
    });
  });
});

test.describe('Source control › git errors', () => {
  test('A pre-commit hook that refuses shows the failure with its output and keeps the file staged', async () => {
    const session = await launchGit((root) => {
      seedGitWorkspace(root);
      const hook = join(root, '.git', 'hooks', 'pre-commit');
      writeFile(hook, '#!/bin/sh\necho "lint: forbidden console.log" >&2\nexit 1\n');
      chmodSync(hook, 0o755);
    });
    try {
      const { page, root } = session;
      await page.getByTestId('git-change-changes-src/routes.js').hover();
      await page.getByTestId('git-change-changes-src/routes.js-stage').click();
      await page.getByTestId('git-commit-open').click();
      await page.getByTestId('git-commit-message').fill('Blocked by hook');
      await page.getByTestId('git-commit-btn').click();

      await expect(page.getByTestId('git-error')).toBeVisible();
      await page.keyboard.press('Escape'); // the commit popover stays open over the alert on failure
      await page.getByTestId('git-error-details-toggle').click();
      await expect(page.getByTestId('git-error-details')).toContainText('forbidden console.log');
      expect(gitLog(root)).not.toContain('Blocked by hook');
      await expect(page.getByTestId('git-change-staged-src/routes.js')).toBeVisible();

      await page.getByTestId('git-error').getByRole('button', { name: 'Close' }).click();
      await expect(page.getByTestId('git-error')).toBeHidden();
    } finally {
      await session.close();
    }
  });

  test('Publishing a branch with no remote reports the error instead of failing silently', async () => {
    const session = await launchGit(seedGitWorkspace);
    try {
      const { page } = session;
      await page.getByTestId('git-sync-menu').click();
      await page.getByTestId('git-sync-push').click();
      await expect(page.getByTestId('git-error')).toBeVisible();
    } finally {
      await session.close();
    }
  });

  test('A folder that is not a repository offers git init, and initialising it lists its files', async () => {
    const session = await launchGit((root) => {
      mkdirSync(root, { recursive: true });
      writeFile(join(root, 'notes.md'), '# notes\n');
    });
    try {
      const { page, root } = session;
      await expect(page.getByTestId('git-init-card')).toBeVisible();
      await page.getByTestId('git-init-card-btn').click();
      await expect.poll(() => existsSync(join(root, '.git'))).toBe(true);
      await expect(page.getByTestId('git-change-changes-notes.md')).toBeVisible();
      await expect(page.getByTestId('git-init-card')).toBeHidden();
    } finally {
      await session.close();
    }
  });
});
