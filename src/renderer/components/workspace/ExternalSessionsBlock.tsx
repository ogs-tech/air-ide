import { useState } from 'react';
import { Alert, Button, Stack, Tooltip, Typography } from '@mui/material';
import { callIpc, IpcCallError } from '../../lib/ipc.js';
import { useSetExternalConsent } from '../../hooks/use-external-sessions.js';
import { compareRows, UNTITLED_LABEL, type SessionRowState } from '../../lib/session-attention.js';
import type { ExternalSession } from '../../../shared/external-session.js';
import type { SessionSnapshot, SessionSnapshotWithOutput } from '../../../shared/session.js';
import { SessionRow } from './SessionRow.js';
import { requestOpenExternal } from '../../lib/external-open-store.js';

export function externalStateOf(session: ExternalSession): SessionRowState {
  return session.closed ? 'exited' : (session.activity ?? 'idle');
}

/** The conversation can be taken over once nothing is typing into it (idle or closed) and its folder is known. */
export function canAssumeExternal(session: ExternalSession): boolean {
  const state = externalStateOf(session);
  return session.cwd !== null && (state === 'idle' || state === 'exited');
}

/** One-time consent: exact state needs hooks in the harnesses' own config; "Só estimado" touches nothing. */
export function ExternalConsentBanner(): React.ReactElement {
  const setConsent = useSetExternalConsent();
  const [error, setError] = useState<string | null>(null);
  const choose = (mode: 'exact' | 'estimated'): void => {
    setError(null);
    setConsent(mode).catch((err: unknown) => setError(err instanceof IpcCallError ? err.message : String(err)));
  };
  return (
    <Alert
      severity="info"
      data-testid="external-consent-banner"
      sx={{ mx: 0.75, mb: 0.75, alignItems: 'flex-start', '& .MuiAlert-message': { minWidth: 0, flex: 1 } }}
    >
      <Typography variant="body2" sx={{ fontWeight: 600 }}>
        Ver o estado exato de sessões fora do app
      </Typography>
      {/* A path has no spaces to wrap at: let it break anywhere rather than run past the panel's edge. */}
      <Typography variant="caption" sx={{ display: 'block', '& code': { overflowWrap: 'anywhere' } }}>
        Adiciona hooks de estado a <code>~/.claude/settings.json</code> e <code>~/.cursor/hooks.json</code> (só as entradas do app; removível em Configurações).
      </Typography>
      {/* Below the text, not in the Alert's `action` slot: that slot sits beside the message and squeezes it to one word per line in a narrow panel. */}
      <Stack direction="row" spacing={0.5} useFlexGap sx={{ mt: 0.75, flexWrap: 'wrap' }}>
        <Button size="small" color="inherit" onClick={() => choose('estimated')} data-testid="external-consent-estimated">
          Só estimado
        </Button>
        <Button size="small" variant="outlined" color="inherit" onClick={() => choose('exact')} data-testid="external-consent-exact">
          Ativar
        </Button>
      </Stack>
      {error && (
        <Typography variant="caption" color="error" role="alert">
          {error}
        </Typography>
      )}
    </Alert>
  );
}

interface ExternalSessionRowsProps {
  sessions: readonly ExternalSession[];
  filter: SessionRowState | null;
  now: number;
  onAssumed: (session: SessionSnapshot) => void;
  onError: (message: string) => void;
}

/** External sessions as rows of the same list: same indicator, labelled "externa · <terminal>", dashed when only estimated. */
export function ExternalSessionRows({ sessions, filter, now, onAssumed, onError }: ExternalSessionRowsProps): React.ReactElement | null {
  const rows = sessions
    .map((session) => ({ session, state: externalStateOf(session) }))
    .filter((row) => filter === null || row.state === filter)
    .sort((a, b) =>
      compareRows(
        { state: a.state, sortAt: a.session.lastEventAt, waitingSince: a.state === 'needs-input' ? (a.session.activitySince ?? null) : null },
        { state: b.state, sortAt: b.session.lastEventAt, waitingSince: b.state === 'needs-input' ? (b.session.activitySince ?? null) : null },
      ),
    );
  if (rows.length === 0) return null;

  const assume = async (session: ExternalSession): Promise<void> => {
    try {
      onAssumed(await callIpc<SessionSnapshotWithOutput>('externalSession.assume', { id: session.id }));
    } catch (err) {
      onError(err instanceof IpcCallError ? err.message : String(err));
    }
  };

  return (
    <>
      {rows.map(({ session, state }) => {
        const canAssume = canAssumeExternal(session);
        const subtitle = [
          `externa${session.terminal ? ` · ${session.terminal}` : ''}`,
          session.label,
          session.closed ? 'motivo desconhecido' : session.precision === 'estimated' ? 'estimado' : null,
        ]
          .filter(Boolean)
          .join(' · ');
        return (
          <SessionRow
            key={`external:${session.id}`}
            testId={`tree-external-session-${session.id}`}
            label={session.title ?? UNTITLED_LABEL}
            harness={session.harness}
            state={state}
            {...(session.attention ? { attention: session.attention } : {})}
            waitingSince={state === 'needs-input' ? (session.activitySince ?? null) : null}
            idleSince={state === 'idle' ? (session.activitySince ?? null) : null}
            workingSince={state === 'working' ? (session.activitySince ?? null) : null}
            activityDetail={session.activityDetail}
            subtitle={subtitle}
            estimated={session.precision === 'estimated'}
            now={now}
            history={null}
            onOpen={() => requestOpenExternal(session.id)}
            actions={
              <>
                <Tooltip title={canAssume ? 'Retomar esta conversa no app' : 'Disponível quando a sessão externa estiver ociosa ou fechada'}>
                  <span>
                    <Button size="small" disabled={!canAssume} sx={{ minWidth: 0, px: 0.75, fontSize: '0.625rem' }} onClick={(e) => { e.stopPropagation(); void assume(session); }} data-testid={`external-assume-${session.id}`}>
                      Assumir aqui
                    </Button>
                  </span>
                </Tooltip>
              </>
            }
          />
        );
      })}
    </>
  );
}
