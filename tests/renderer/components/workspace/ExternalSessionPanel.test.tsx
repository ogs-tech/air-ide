import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ExternalSessionPanel } from '../../../../src/renderer/components/workspace/ExternalSessionPanel.js';
import type { ExternalSession } from '../../../../src/shared/external-session.js';
import { fail, mockApi, ok, renderWithQuery, type CallSpy } from '../../test-utils.js';

const external = (over: Partial<ExternalSession> = {}): ExternalSession => ({
  id: 'e1', harness: 'claude', cwd: '/w/api', label: 'api', closed: false, precision: 'measured', lastEventAt: 1, activity: 'idle', activitySince: 1, terminal: 'iTerm2', ...over,
});

const transcript = [
  JSON.stringify({ type: 'user', message: { content: 'Does the 100% coupon work?' } }),
  JSON.stringify({ type: 'assistant', message: { model: 'claude-sonnet-5-5', content: [{ type: 'text', text: 'It does.' }, { type: 'tool_use', name: 'Read', input: { file_path: 'cart.test.ts' } }] } }),
].join('\n');

let call: CallSpy;
function route(session: ExternalSession | null, extra: Record<string, unknown> = {}): void {
  call.mockImplementation(async (method: string) => {
    if (method === 'externalSession.state') return ok({ consent: 'exact', hooksInstalled: {}, sessions: session ? [session] : [] });
    if (method === 'externalSession.tail') return ok(transcript);
    if (method in extra) return extra[method];
    return ok(null);
  });
}
const renderPanel = (onAssumed = vi.fn()) => renderWithQuery(<ExternalSessionPanel externalId="e1" onAssumed={onAssumed} />);

beforeEach(() => {
  call = mockApi();
});

describe('ExternalSessionPanel', () => {
  it('shows the conversation read-only, with no text input anywhere', async () => {
    route(external());
    renderPanel();

    expect(await screen.findByText('Does the 100% coupon work?')).toBeInTheDocument();
    expect(screen.getByText('It does.')).toBeInTheDocument();
    expect(screen.getByTestId('external-transcript-tool')).toHaveTextContent('Read');
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(screen.getByTestId('session-status-line')).toBeInTheDocument();
  });

  it('offers "Assumir" when idle and adopts the conversation on click', async () => {
    const snapshot = { sessionId: 's9', label: 'api' };
    route(external(), { 'externalSession.assume': ok(snapshot) });
    const onAssumed = vi.fn();
    renderPanel(onAssumed);

    const button = await screen.findByTestId('external-session-assume');
    await waitFor(() => expect(button).toBeEnabled());
    expect(button).toHaveTextContent('Assumir');
    await userEvent.click(button);

    await waitFor(() => expect(onAssumed).toHaveBeenCalledWith(snapshot));
    expect(call).toHaveBeenCalledWith('externalSession.assume', { id: 'e1' });
  });

  it.each([
    ['working', { activity: 'working' as const }, 'Disponível quando a sessão ficar ociosa.'],
    ['needs-input', { activity: 'needs-input' as const }, 'Responda lá ou espere a sessão ficar ociosa para assumir.'],
  ])('blocks "Assumir" while the external session is %s and says why', async (_name, over, hint) => {
    route(external(over));
    renderPanel();

    expect(await screen.findByText(hint)).toBeInTheDocument();
    expect(screen.getByTestId('external-session-assume')).toBeDisabled();
  });

  it('offers "Retomar aqui" once the external process is gone', async () => {
    route(external({ closed: true }));
    renderPanel();

    await waitFor(() => expect(screen.getByTestId('external-session-assume')).toHaveTextContent('Retomar aqui'));
    expect(screen.getByTestId('external-session-assume')).toBeEnabled();
  });

  it('blocks the action when the conversation folder is unknown', async () => {
    route(external({ cwd: null }));
    renderPanel();

    expect(await screen.findByText('Não foi possível descobrir a pasta desta conversa.')).toBeInTheDocument();
    expect(screen.getByTestId('external-session-assume')).toBeDisabled();
  });

  it('shows the refusal in the dock and lets the person try again', async () => {
    route(external(), { 'externalSession.assume': fail('validation', 'A sessão externa está trabalhando') });
    const onAssumed = vi.fn();
    renderPanel(onAssumed);

    const button = await screen.findByTestId('external-session-assume');
    await waitFor(() => expect(button).toBeEnabled());
    await userEvent.click(button);

    expect(await screen.findByRole('alert')).toHaveTextContent('A sessão externa está trabalhando');
    expect(onAssumed).not.toHaveBeenCalled();
    expect(screen.getByTestId('external-session-assume')).toBeEnabled();
  });

  it('keeps the dock honest when the session left the list', async () => {
    route(null);
    renderPanel();

    expect(await screen.findByText('Esta conversa não está mais visível')).toBeInTheDocument();
    expect(screen.getByTestId('external-session-assume')).toBeDisabled();
  });
});
