import { Box, Stack, Tooltip, Typography } from '@mui/material';
import { contextFraction, contextLevel, type SessionMetrics } from '../../shared/session-metrics.js';

const COLORS = { ok: 'text.disabled', warn: 'warning.main', danger: 'error.main' } as const;

/** Thin bar: amber over 70%, red over 90%. Hidden when the window is unknown. `estimated` prefixes "~"; `showValue` prints the percentage beside the bar. */
export function ContextBar({ metrics, estimated = false, showValue = false, testId }: { metrics: SessionMetrics | undefined; estimated?: boolean; showValue?: boolean; testId?: string }): React.ReactElement | null {
  const fraction = contextFraction(metrics);
  if (fraction === null) return null;
  const level = contextLevel(fraction);
  const pct = Math.round(fraction * 100);
  const label = `Contexto ${estimated ? '~' : ''}${pct}%`;
  const bar = (
    <Tooltip title={label}>
      <Box
        role="meter"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        data-testid={testId}
        data-level={level}
        sx={{ height: 3, width: 40, borderRadius: 2, bgcolor: 'action.hover', overflow: 'hidden', flexShrink: 0 }}
      >
        <Box
          sx={{
            height: '100%',
            width: `${pct}%`,
            bgcolor: COLORS[level],
            transition: 'width 400ms ease-out, background-color 400ms',
            '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
          }}
        />
      </Box>
    </Tooltip>
  );
  if (!showValue) return bar;
  return (
    <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center', flexShrink: 0 }}>
      {bar}
      <Typography
        component="span"
        data-testid={testId ? `${testId}-value` : undefined}
        sx={{ fontSize: '0.625rem', fontVariantNumeric: 'tabular-nums', minWidth: '3ch', textAlign: 'right', color: level === 'ok' ? 'text.secondary' : COLORS[level], transition: 'color 400ms' }}
      >
        {`${estimated ? '~' : ''}${pct}%`}
      </Typography>
    </Stack>
  );
}
