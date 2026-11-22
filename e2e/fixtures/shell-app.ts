import { join } from 'node:path';
import { launchApp, seedGitWorkspace, seedWorkspaceRegistry, type AppSession } from './app.js';

/** The "acme-api" git workspace (branch `main`, two uncommitted files) opened at launch — the shell specs' common start. */
export function launchShellApp(): Promise<AppSession> {
  return launchApp({
    seed: (home) => {
      const root = join(home, 'Projects', 'acme-api');
      seedGitWorkspace(root);
      seedWorkspaceRegistry(home, [{ id: 'acme', name: 'acme-api', rootPath: root }], 'acme');
    },
  });
}

/** Width in px of a panel/card; a collapsed panel stays in the DOM at width 0. */
export async function widthOf(session: AppSession, testId: string): Promise<number> {
  return (await session.page.getByTestId(testId).boundingBox())?.width ?? 0;
}
