import { describe, expect, it, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FileText } from 'lucide-react';
import { WorkbenchTabSwitcher, switcherGroupOf } from '../../../../src/renderer/components/workspace/WorkbenchTabSwitcher.js';
import type { WorkbenchTab } from '../../../../src/renderer/components/workspace/workbench-tab.js';
import { renderWithTheme } from '../../test-utils.js';

const tab = (id: string, over: Partial<WorkbenchTab> = {}): WorkbenchTab => ({ id, kind: 'file', glyph: FileText, label: id, render: () => null, ...over });

function open(tabs: WorkbenchTab[], props: Partial<Parameters<typeof WorkbenchTabSwitcher>[0]> = {}) {
  const onSelect = vi.fn();
  const onClose = vi.fn();
  const anchor = document.createElement('button');
  document.body.appendChild(anchor);
  renderWithTheme(<WorkbenchTabSwitcher tabs={tabs} activeTabId={null} anchor={anchor} onSelect={onSelect} onClose={onClose} {...props} />);
  return { onSelect, onClose };
}

describe('switcherGroupOf', () => {
  it('maps every kind to a group', () => {
    expect(switcherGroupOf('mcp')).toBe('Customizações');
    expect(switcherGroupOf('preview')).toBe('Outras');
    expect(switcherGroupOf('git-diff')).toBe('Git');
  });
});

describe('WorkbenchTabSwitcher', () => {
  const mixed = [
    tab('term', { kind: 'terminal', label: 'zsh' }),
    tab('login.ts', { label: 'login.ts' }),
    tab('s1', { kind: 'session', label: 'Fix login', sessionState: 'idle' }),
    tab('cfg', { kind: 'config', label: 'Configurações' }),
    tab('sk', { kind: 'skill', label: 'review' }),
  ];

  it('orders the groups and omits empty ones', async () => {
    open(mixed);
    const groups = (await screen.findAllByRole('group')).map((g) => g.getAttribute('aria-label'));
    expect(groups).toEqual(['Sessões', 'Arquivos', 'Customizações', 'Terminais', 'Outras']);
  });

  it('filters by label and by breadcrumb, case-insensitively', async () => {
    open([tab('a', { label: 'alpha', breadcrumb: 'apps › Login' }), tab('b', { label: 'beta' })]);
    await userEvent.type(await screen.findByTestId('workbench-switcher-filter'), 'LOG');
    expect(screen.getByTestId('workbench-all-tabs-a')).toBeInTheDocument();
    expect(screen.queryByTestId('workbench-all-tabs-b')).toBeNull();
  });

  it('moves with the arrow keys, opens with Enter and closes with Escape', async () => {
    const { onSelect, onClose } = open(mixed);
    const input = await screen.findByTestId('workbench-switcher-filter');
    // Display order: Sessões(s1), Arquivos(login.ts), Customizações(sk) …
    await userEvent.type(input, '{ArrowDown}{ArrowDown}{Enter}');
    expect(onSelect).toHaveBeenCalledWith('sk');
    await userEvent.type(input, '{Escape}');
    expect(onClose).toHaveBeenCalled();
  });

  it('tells apart tabs with the same label through their breadcrumb', async () => {
    open([
      tab('i1', { kind: 'instruction', label: 'INSTRUCTIONS', breadcrumb: 'brand › INSTRUCTIONS' }),
      tab('i2', { kind: 'instruction', label: 'INSTRUCTIONS', breadcrumb: 'engine › INSTRUCTIONS' }),
    ]);
    expect(within(await screen.findByTestId('workbench-all-tabs-i1')).getByText('brand › INSTRUCTIONS')).toBeInTheDocument();
    expect(within(screen.getByTestId('workbench-all-tabs-i2')).getByText('engine › INSTRUCTIONS')).toBeInTheDocument();
  });

  it('shows each session row with its state', async () => {
    open(mixed);
    expect(within(await screen.findByTestId('workbench-all-tabs-s1')).getByText('Ocioso')).toBeInTheDocument();
  });

  it('lists only needs-input sessions with that initial filter', async () => {
    open([tab('a', { kind: 'session', sessionState: 'needs-input' }), tab('b', { kind: 'session', sessionState: 'idle' }), tab('c')], { initialFilter: 'needs-input' });
    expect(await screen.findByTestId('workbench-all-tabs-a')).toBeInTheDocument();
    expect(screen.queryByTestId('workbench-all-tabs-b')).toBeNull();
    expect(screen.queryByTestId('workbench-all-tabs-c')).toBeNull();
  });

  it('selects a clicked row and closes', async () => {
    const { onSelect, onClose } = open(mixed);
    await userEvent.click(await screen.findByTestId('workbench-all-tabs-login.ts'));
    expect(onSelect).toHaveBeenCalledWith('login.ts');
    expect(onClose).toHaveBeenCalled();
  });
});
