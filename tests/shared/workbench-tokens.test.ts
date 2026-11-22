import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Colour literals belong in tokens.ts; the workbench chrome reads them through the theme.
const FILES = [
  'src/renderer/components/SessionPanel.tsx',
  'src/renderer/components/ContextBar.tsx',
  'src/renderer/components/workspace/TerminalPanel.tsx',
  'src/renderer/components/workspace/WorkbenchCanvas.tsx',
  'src/renderer/components/workspace/WorkbenchTabItem.tsx',
  'src/renderer/components/workspace/WorkbenchTabStrip.tsx',
  'src/renderer/components/workspace/WorkbenchTabSwitcher.tsx',
  'src/renderer/components/workspace/git/DiffView.tsx',
  'src/renderer/lib/tab-tone.ts',
];

describe('workbench colour tokens', () => {
  it.each(FILES)('%s has no #hex or rgba() literal', (file) => {
    const source = readFileSync(resolve(process.cwd(), file), 'utf8');
    expect(source).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(source).not.toMatch(/rgba?\(/);
  });
});
