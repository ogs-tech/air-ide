import { UNTITLED_LABEL } from './session-attention.js';

export const NEW_SESSION_LABEL = 'Nova sessão';

/** First candidate with real text that is not the generic "Untitled" default; "Nova sessão" when none is. */
export function sessionTabLabel(candidates: readonly (string | undefined)[]): string {
  for (const candidate of candidates) {
    const text = candidate?.trim();
    if (text && text !== UNTITLED_LABEL) return text;
  }
  return NEW_SESSION_LABEL;
}
