import { describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FileText, Settings } from 'lucide-react';
import { WorkbenchTabItem } from '../../../../src/renderer/components/workspace/WorkbenchTabItem.js';
import type { WorkbenchTab } from '../../../../src/renderer/components/workspace/workbench-tab.js';
import { createAppTheme } from '../../../../src/renderer/theme.js';
import { tabToneColor } from '../../../../src/renderer/lib/tab-tone.js';
import { renderWithTheme } from '../../test-utils.js';

const tab = (over: Partial<WorkbenchTab> = {}): WorkbenchTab => ({
  id: 't1',
  kind: 'file',
  glyph: FileText,
  label: 'index.ts',
  render: () => null,
  onClose: vi.fn(),
  ...over,
});

const noop = (): void => {};
function renderTab(t: WorkbenchTab, active = false) {
  return renderWithTheme(
    <WorkbenchTabItem tab={t} active={active} draggable={false} onSelect={noop} onContextMenu={noop} onDragStart={noop} onDragOver={noop} onDrop={noop} onDragEnd={noop} />,
  );
}

describe('WorkbenchTabItem', () => {
  it('marks the active tab with a 2px top rule in its kind tone, sized to its label', () => {
    renderTab(tab(), true);
    const el = screen.getByTestId('workbench-tab-t1');
    expect(el).toHaveAttribute('data-active', 'true');
    expect(el).toHaveAttribute('data-kind', 'file');
    const style = getComputedStyle(el);
    expect(style.borderTopWidth).toBe('2px');
    const probe = document.createElement('span');
    probe.style.color = tabToneColor(createAppTheme('light'), 'file');
    document.body.appendChild(probe);
    expect(style.borderTopColor).toBe(getComputedStyle(probe).color);
    probe.remove();
    expect(style.flexGrow).toBe('0');
    expect(style.flexShrink).toBe('0');
  });

  it('lets an inactive tab shrink with a cap', () => {
    renderTab(tab());
    const el = screen.getByTestId('workbench-tab-t1');
    expect(el).toHaveAttribute('data-active', 'false');
    expect(el).toHaveStyle({ maxWidth: '150px' });
    const style = getComputedStyle(el);
    expect([style.flexGrow, style.flexShrink]).toEqual(['1', '1']);
  });

  it.each(['needs-input', 'working', 'idle', 'exited'] as const)('always renders the state dot for a %s session', (sessionState) => {
    renderTab(tab({ kind: 'session', sessionState, sessionChannel: 'claude', label: 'Nova sessão' }));
    expect(screen.getByTestId('workbench-tab-state-t1')).toBeInTheDocument();
  });

  it('renders an icon-only tab without its label but keeps the aria-label', () => {
    renderTab(tab({ kind: 'config', glyph: Settings, label: 'Configurações', iconOnly: true }));
    expect(screen.queryByText('Configurações')).toBeNull();
    expect(screen.getByRole('button', { name: 'Configurações' })).toBeInTheDocument();
  });

  it('never shows "Untitled" for a session labelled Nova sessão', () => {
    renderTab(tab({ kind: 'session', sessionState: 'idle', sessionChannel: 'claude', label: 'Nova sessão' }));
    expect(screen.queryByText('Untitled')).toBeNull();
    expect(screen.getByText('Nova sessão')).toBeInTheDocument();
  });

  it('declares the needs-input ring only for users who accept motion', () => {
    const { baseElement } = renderTab(tab({ kind: 'session', sessionState: 'needs-input', sessionChannel: 'claude' }));
    const css = Array.from(document.querySelectorAll('style')).map((node) => node.textContent ?? '').join('\n');
    expect(css).toMatch(/prefers-reduced-motion: ?no-preference/);
    // The ring's keyframes are only ever referenced from inside that media block.
    const outside = css.replace(/@media \(prefers-reduced-motion: ?no-preference\)\{[^@]*?\}\}/g, '');
    expect(outside).not.toMatch(/animation:[^;]*2s ease-out infinite/);
    expect(baseElement).toBeTruthy();
  });

  it('closes from its close control without selecting the tab', async () => {
    const onClose = vi.fn();
    renderTab(tab({ onClose }), true);
    await userEvent.click(screen.getByTestId('workbench-tab-close-t1'));
    expect(onClose).toHaveBeenCalledOnce();
  });
});
