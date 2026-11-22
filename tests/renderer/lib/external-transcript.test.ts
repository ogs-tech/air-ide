import { describe, expect, it } from 'vitest';
import { parseTranscript } from '../../../src/renderer/lib/external-transcript.js';

const line = (o: unknown): string => JSON.stringify(o);

describe('parseTranscript', () => {
  it('turns user text, assistant text and tool calls into conversation items', () => {
    const jsonl = [
      line({ type: 'user', message: { role: 'user', content: 'Fix the rounding' } }),
      line({
        type: 'assistant',
        message: {
          model: 'claude-sonnet-5-5',
          usage: { input_tokens: 10, cache_read_input_tokens: 90, cache_creation_input_tokens: 5 },
          content: [
            { type: 'text', text: 'On it.' },
            { type: 'tool_use', name: 'Edit', input: { file_path: 'src/cart/CartService.ts', old_string: 'x' } },
          ],
        },
      }),
    ].join('\n');

    const { items, metrics } = parseTranscript(jsonl);

    expect(items).toEqual([
      { kind: 'user', text: 'Fix the rounding' },
      { kind: 'assistant', text: 'On it.' },
      { kind: 'tool', name: 'Edit', target: 'src/cart/CartService.ts' },
    ]);
    expect(metrics).toEqual({ model: 'claude-sonnet-5-5', contextTokens: 105 });
  });

  it('skips tool results, meta turns, sidechains, CLI echoes and unreadable lines', () => {
    const jsonl = [
      line({ type: 'user', message: { content: [{ type: 'tool_result', content: 'ok' }] } }),
      line({ type: 'user', isMeta: true, message: { content: 'meta' } }),
      line({ type: 'user', isSidechain: true, message: { content: 'sub-agent' } }),
      line({ type: 'user', message: { content: '<command-name>/clear</command-name>' } }),
      '{"type":"user","message":{"content":"cut o',
      line({ type: 'summary', summary: 'x' }),
      line({ type: 'user', message: { content: [{ type: 'text', text: 'Real question' }] } }),
    ].join('\n');

    expect(parseTranscript(jsonl).items).toEqual([{ kind: 'user', text: 'Real question' }]);
  });

  it('truncates a long tool target to one line and ignores the synthetic model', () => {
    const command = `echo ${'a'.repeat(200)}\nsecond line`;
    const { items, metrics } = parseTranscript(
      line({ type: 'assistant', message: { model: '<synthetic>', content: [{ type: 'tool_use', name: 'Bash', input: { command } }] } }),
    );

    const tool = items[0];
    expect(tool?.kind === 'tool' && tool.target?.length).toBe(90);
    expect(tool?.kind === 'tool' && tool.target?.endsWith('…')).toBe(true);
    expect(metrics.model).toBeUndefined();
  });

  it('returns nothing for an empty tail', () => {
    expect(parseTranscript('')).toEqual({ items: [], metrics: {} });
  });
});
