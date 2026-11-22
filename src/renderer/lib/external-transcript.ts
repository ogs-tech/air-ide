import type { SessionMetrics } from '../../shared/session-metrics.js';

export type TranscriptItem =
  | { kind: 'user'; text: string }
  | { kind: 'assistant'; text: string }
  /** A tool call, collapsed to its name and the one argument that says what it touched. */
  | { kind: 'tool'; name: string; target: string | null };

export interface ParsedTranscript {
  items: TranscriptItem[];
  metrics: Pick<SessionMetrics, 'model' | 'contextTokens'>;
}

const TARGET_KEYS = ['file_path', 'path', 'command', 'pattern', 'url', 'description'] as const;
const MAX_TARGET = 90;

function toolTarget(input: unknown): string | null {
  if (typeof input !== 'object' || input === null) return null;
  const record = input as Record<string, unknown>;
  for (const key of TARGET_KEYS) {
    const value = record[key];
    if (typeof value === 'string' && value.trim()) {
      const line = value.trim().split('\n')[0] ?? '';
      return line.length > MAX_TARGET ? `${line.slice(0, MAX_TARGET - 1)}…` : line;
    }
  }
  return null;
}

/** Text the CLI injects as a "user" turn (slash-command echoes, local-command output, reminders): not something the person wrote. */
function isSyntheticUserText(text: string): boolean {
  return text.startsWith('<') || text.startsWith('Caveat:');
}

function userTexts(content: unknown): string[] {
  if (typeof content === 'string') return [content];
  if (!Array.isArray(content)) return [];
  // `tool_result` parts are the machine answering itself; only `text` parts are the person.
  return content.flatMap((part: unknown) => {
    const p = part as { type?: unknown; text?: unknown };
    return p.type === 'text' && typeof p.text === 'string' ? [p.text] : [];
  });
}

/**
 * Turns a Claude JSONL transcript tail into the conversation a person would read:
 * what they typed, what the assistant wrote, and each tool call as one line.
 * Tolerant by design — a partial line, an unknown entry type or a sidechain is skipped, never thrown.
 */
export function parseTranscript(jsonl: string): ParsedTranscript {
  const items: TranscriptItem[] = [];
  const metrics: ParsedTranscript['metrics'] = {};
  for (const line of jsonl.split('\n')) {
    if (!line.trim()) continue;
    let entry: { type?: unknown; isSidechain?: unknown; isMeta?: unknown; message?: Record<string, unknown> };
    try {
      entry = JSON.parse(line) as typeof entry;
    } catch {
      continue;
    }
    if (entry.isSidechain === true || entry.isMeta === true || !entry.message) continue;
    if (entry.type === 'user') {
      for (const text of userTexts(entry.message.content)) {
        const trimmed = text.trim();
        if (trimmed && !isSyntheticUserText(trimmed)) items.push({ kind: 'user', text: trimmed });
      }
    } else if (entry.type === 'assistant') {
      const model = entry.message.model;
      if (typeof model === 'string' && model !== '<synthetic>') metrics.model = model;
      const usage = entry.message.usage as { input_tokens?: number; cache_creation_input_tokens?: number; cache_read_input_tokens?: number } | undefined;
      if (usage) {
        const total = (usage.input_tokens ?? 0) + (usage.cache_creation_input_tokens ?? 0) + (usage.cache_read_input_tokens ?? 0);
        if (total > 0) metrics.contextTokens = total;
      }
      const content = entry.message.content;
      if (!Array.isArray(content)) continue;
      for (const part of content as Array<{ type?: unknown; text?: unknown; name?: unknown; input?: unknown }>) {
        if (part.type === 'text' && typeof part.text === 'string' && part.text.trim()) items.push({ kind: 'assistant', text: part.text.trim() });
        else if (part.type === 'tool_use' && typeof part.name === 'string') items.push({ kind: 'tool', name: part.name, target: toolTarget(part.input) });
      }
    }
  }
  return { items, metrics };
}
