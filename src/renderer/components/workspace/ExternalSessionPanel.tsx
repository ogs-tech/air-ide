import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Box, Button, Typography } from '@mui/material';
import { MessageSquare } from 'lucide-react';
import { callIpc, IpcCallError } from '../../lib/ipc.js';
import { useExternalSessions } from '../../hooks/use-external-sessions.js';
import { parseTranscript, type TranscriptItem } from '../../lib/external-transcript.js';
import { FILTER_LABELS } from '../../lib/session-attention.js';
import { contextWindowFor, type SessionMetrics } from '../../../shared/session-metrics.js';
import type { ExternalSession } from '../../../shared/external-session.js';
import type { SessionSnapshotWithOutput } from '../../../shared/session.js';
import { SessionStatusLine, type HeaderStatus } from '../SessionPanel.js';
import { EmptyState } from '../ds/EmptyState.js';
import { canAssumeExternal, externalStateOf } from './ExternalSessionsBlock.js';

interface ExternalSessionPanelProps {
  /** The harness's own conversation id — the tab is keyed by it, and the live session is looked up from the shared list. */
  externalId: string;
  /** The conversation now runs in the app: the caller swaps this tab for the real session's. */
  onAssumed: (session: SessionSnapshotWithOutput) => void;
}

const MONO = 'ui-monospace, SFMono-Regular, Menlo, monospace';
/** How close to the bottom still counts as "following" the conversation. */
const FOLLOW_SLACK_PX = 48;

function Item({ item }: { item: TranscriptItem }): React.ReactElement {
  if (item.kind === 'tool') {
    return (
      <Box
        data-testid="external-transcript-tool"
        sx={{ alignSelf: 'flex-start', maxWidth: '100%', fontFamily: MONO, fontSize: '0.6875rem', color: 'text.secondary', border: 1, borderColor: 'divider', borderRadius: 1, px: 1, py: 0.25, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
      >
        {item.name}
        {item.target && <Box component="span" sx={{ color: 'text.primary', ml: 1 }}>{item.target}</Box>}
      </Box>
    );
  }
  const mine = item.kind === 'user';
  return (
    <Typography
      data-testid={`external-transcript-${item.kind}`}
      sx={{
        fontSize: '0.8125rem',
        maxWidth: '72ch',
        whiteSpace: 'pre-wrap',
        overflowWrap: 'anywhere',
        ...(mine ? { alignSelf: 'flex-end', bgcolor: 'action.hover', borderRadius: '10px 10px 2px 10px', px: 1.5, py: 1 } : {}),
      }}
    >
      {item.text}
    </Typography>
  );
}

/** What the dock says about the conversation and what stands between the person and answering it. */
function dockCopy(session: ExternalSession | undefined, assumable: boolean): { title: string; hint: string; action: string } {
  if (!session) return { title: 'Esta conversa não está mais visível', hint: 'Ela saiu da lista de sessões externas.', action: 'Assumir' };
  const where = session.terminal ?? 'outro terminal';
  if (session.closed) return { title: `Encerrada em ${where}`, hint: session.cwd ? 'Retome a conversa aqui, com o histórico.' : 'Não foi possível descobrir a pasta desta conversa.', action: 'Retomar aqui' };
  if (!assumable && session.cwd === null) return { title: `Rodando em ${where}`, hint: 'Não foi possível descobrir a pasta desta conversa.', action: 'Assumir' };
  switch (externalStateOf(session)) {
    case 'working':
      return { title: `Em uso em ${where}${session.activityDetail ? `, ${session.activityDetail}` : ''}`, hint: 'Disponível quando a sessão ficar ociosa.', action: 'Assumir' };
    case 'needs-input':
      return { title: `Aguardando resposta em ${where}`, hint: 'Responda lá ou espere a sessão ficar ociosa para assumir.', action: 'Assumir' };
    default:
      return { title: `Rodando em ${where}`, hint: 'Assumir para responder aqui. O processo externo não é encerrado.', action: 'Assumir' };
  }
}

/**
 * An external conversation as a Workbench tab: the same frame as a session — content above, the 28px status line below —
 * but the body is the conversation read off the transcript, because the app owns no PTY for it. Where the CLI's input
 * would be, a dock offers the one thing that can be done: take the conversation over.
 */
export function ExternalSessionPanel({ externalId, onAssumed }: ExternalSessionPanelProps): React.ReactElement {
  const { data } = useExternalSessions();
  const session = data?.sessions.find((s) => s.id === externalId);
  const [raw, setRaw] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scroller = useRef<HTMLDivElement | null>(null);
  const following = useRef(true);

  useEffect(() => {
    let active = true;
    const load = (): void => {
      void callIpc<string>('externalSession.tail', { id: externalId })
        .then((tail) => {
          if (active) setRaw(typeof tail === 'string' ? tail : '');
        })
        .catch(() => {});
    };
    load();
    const off = window.api.externalSession.onChanged(load);
    return () => {
      active = false;
      off();
    };
  }, [externalId]);

  const { items, metrics: parsed } = useMemo(() => parseTranscript(raw), [raw]);

  // Follow the conversation while the person is at the bottom; leave them where they scrolled otherwise.
  useLayoutEffect(() => {
    const el = scroller.current;
    if (el && following.current) el.scrollTop = el.scrollHeight;
  }, [items]);

  const state = session ? externalStateOf(session) : 'exited';
  const status: HeaderStatus = { state, label: FILTER_LABELS[state] };
  const detail = session?.activityDetail ?? ['externa', session?.terminal, session?.precision === 'estimated' ? 'estimado' : null].filter(Boolean).join(' · ');
  const channel = session?.harness ?? 'claude';
  const window_ = contextWindowFor(parsed.model, channel);
  const metrics: SessionMetrics = {
    ...(parsed.model ? { model: parsed.model } : {}),
    ...(parsed.contextTokens !== undefined ? { contextTokens: parsed.contextTokens } : {}),
    ...(window_ !== null ? { contextWindow: window_ } : {}),
  };

  const assumable = session !== undefined && canAssumeExternal(session);
  const copy = dockCopy(session, assumable);
  const assume = async (): Promise<void> => {
    setBusy(true);
    setError(null);
    try {
      onAssumed(await callIpc<SessionSnapshotWithOutput>('externalSession.assume', { id: externalId }));
    } catch (err) {
      setError(err instanceof IpcCallError ? err.message : String(err));
      setBusy(false);
    }
  };

  return (
    <Box data-testid="external-session-panel" sx={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      <Box
        ref={scroller}
        data-testid="external-session-transcript"
        onScroll={(e) => {
          const el = e.currentTarget;
          following.current = el.scrollHeight - el.scrollTop - el.clientHeight < FOLLOW_SLACK_PX;
        }}
        sx={{ flex: 1, minHeight: 0, overflowY: 'auto', px: 2.25, py: 2, display: 'flex', flexDirection: 'column', gap: 1.5 }}
      >
        {items.length === 0 ? (
          <EmptyState glyph={MessageSquare} title="Sem conversa para mostrar" description="O transcript desta sessão ainda não existe ou não pôde ser lido. Você ainda pode assumir a conversa." testId="external-session" />
        ) : (
          items.map((item, i) => <Item key={i} item={item} />)
        )}
      </Box>
      <Box
        data-testid="external-session-dock"
        sx={{ flex: 'none', mx: 1.5, mb: 1.25, px: 1.5, py: 1.25, display: 'flex', alignItems: 'center', gap: 1.5, bgcolor: 'action.hover', border: 1, borderColor: 'divider', borderRadius: 2.5 }}
      >
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontSize: '0.8125rem' }}>{copy.title}</Typography>
          <Typography
            role={error ? 'alert' : undefined}
            sx={{ fontSize: '0.75rem', color: error ? 'error.main' : 'text.secondary' }}
          >
            {error ?? copy.hint}
          </Typography>
        </Box>
        <Button
          variant="contained"
          size="small"
          disabled={!assumable || busy}
          onClick={() => void assume()}
          data-testid="external-session-assume"
          sx={{ flex: 'none' }}
        >
          {busy ? 'Retomando…' : copy.action}
        </Button>
      </Box>
      <SessionStatusLine status={status} detail={detail} metrics={metrics} channel={channel} />
    </Box>
  );
}
