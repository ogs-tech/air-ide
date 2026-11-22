import { describe, it, expect } from 'vitest';
import { sessionTabLabel } from '../../../src/renderer/lib/session-tab-label.js';

describe('sessionTabLabel', () => {
  it('skips the generic Untitled default', () => {
    expect(sessionTabLabel(['Fix login', 'Untitled'])).toBe('Fix login');
    expect(sessionTabLabel(['Untitled', 'Fix login'])).toBe('Fix login');
  });
  it('falls back to "Nova sessão" when nothing real is left', () => {
    expect(sessionTabLabel([undefined, 'Untitled', ''])).toBe('Nova sessão');
    expect(sessionTabLabel([])).toBe('Nova sessão');
  });
  it('ignores blank candidates', () => {
    expect(sessionTabLabel(['  ', 'Refactor'])).toBe('Refactor');
  });
});
