/**
 * How the sessions list (a row click) and a clicked notification ask the workspace screen to open an external
 * session's tab without threading a callback through every panel in between. The screen registers while mounted.
 */
let handler: ((externalId: string) => void) | null = null;

export function registerOpenExternal(next: (externalId: string) => void): () => void {
  handler = next;
  return () => {
    if (handler === next) handler = null;
  };
}

export function requestOpenExternal(externalId: string): void {
  handler?.(externalId);
}
