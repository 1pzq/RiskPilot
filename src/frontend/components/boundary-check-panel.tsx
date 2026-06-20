'use client';

import { useCallback, useState } from 'react';
import { CheckCircle2, Clock3, RefreshCw, ShieldAlert, ShieldCheck, XCircle } from 'lucide-react';

import type { BoundaryCheckResult } from '@/app/api/boundary-check/route';

type BoundaryCheckResponse = {
  ok: boolean;
  walletSignatureRequested: boolean;
  results: BoundaryCheckResult[];
  error?: string;
};

async function fetchBoundaryChecks(): Promise<BoundaryCheckResponse> {
  const response = await fetch('/api/boundary-check', {
    cache: 'no-store',
  });
  const nextPayload = (await response.json()) as BoundaryCheckResponse;

  if (!response.ok || !nextPayload.ok) {
    throw new Error(nextPayload.error ?? `Boundary check returned ${response.status}`);
  }

  return nextPayload;
}

const CHECK_PLACEHOLDERS: BoundaryCheckResult[] = [
  {
    id: 'execute-preview-rejection',
    label: '/api/execute rejects What-if preview payloads',
    expected: 'HTTP 400; no execution is prepared',
    actual: 'Click Run checks to submit a safe local request.',
    passed: false,
    evidenceRef: '/api/execute preview guard',
  },
  {
    id: 'audit-preview-rejection',
    label: '/api/audit rejects What-if preview payloads',
    expected: 'HTTP 400; no archive package is accepted',
    actual: 'Click Run checks to submit a safe local request.',
    passed: false,
    evidenceRef: '/api/audit preview guard',
  },
  {
    id: 'policy-blocked-execution',
    label: 'Over-budget Policy is blocked',
    expected: 'HTTP 400 before execution preparation',
    actual: 'Click Run checks to submit an over-budget Policy.',
    passed: false,
    evidenceRef: 'validateExecutionPolicy',
  },
  {
    id: 'ai-posture-lock',
    label: 'AI wording cannot change final posture',
    expected: 'Malicious wording is ignored; deterministic command remains Prepare only',
    actual: 'Click Run checks to compare AI wording with the locked final command.',
    passed: false,
    evidenceRef: 'incidentRoom.finalCommand',
  },
];

function failedBoundaryPayload(error: unknown): BoundaryCheckResponse {
  return {
    ok: false,
    walletSignatureRequested: false,
    results: [],
    error: error instanceof Error ? error.message : 'Boundary check failed.',
  };
}

type BoundaryCheckPanelProps = {
  compact?: boolean;
};

export function BoundaryCheckPanel({ compact = false }: BoundaryCheckPanelProps) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [payload, setPayload] = useState<BoundaryCheckResponse | null>(null);

  const runChecks = useCallback(async () => {
    setStatus('loading');
    setPayload(null);

    try {
      const nextPayload = await fetchBoundaryChecks();
      setPayload(nextPayload);
      setStatus('ready');
    } catch (error) {
      setPayload(failedBoundaryPayload(error));
      setStatus('error');
    }
  }, []);

  const ok = status === 'ready' && payload?.ok;
  const displayedResults = payload?.results.length ? payload.results : CHECK_PLACEHOLDERS;
  const summaryResult =
    status === 'idle'
      ? 'Waiting for judge click'
      : ok
        ? '4 checks passed'
        : status === 'error'
          ? 'Check failed'
        : 'Running checks';
  const checkList = (
    <div className="boundaryCheckList">
      {displayedResults.map((result) => (
        <article
          className={`boundaryCheckItem ${
            status === 'idle'
              ? 'boundaryCheckItemPending'
              : status === 'loading'
                ? 'boundaryCheckItemRunning'
                : result.passed
                  ? 'boundaryCheckItemPass'
                  : 'boundaryCheckItemFail'
          }`}
          key={result.id}
        >
          {status === 'idle' ? (
            <Clock3 size={16} />
          ) : status === 'loading' ? (
            <RefreshCw size={16} className="archiveStepSpinner" />
          ) : result.passed ? (
            <CheckCircle2 size={16} />
          ) : (
            <XCircle size={16} />
          )}
          <div>
            <div className="boundaryCheckItemHeader">
              <strong>{result.label}</strong>
              <em>
                {status === 'idle'
                  ? 'Ready'
                  : status === 'loading'
                    ? 'Running'
                    : result.passed
                      ? 'PASS'
                      : 'FAIL'}
              </em>
            </div>
            <div className="boundaryExpectationGrid">
              <span>Expected</span>
              <p>{result.expected}</p>
              <span>Actual</span>
              <p>{status === 'loading' ? 'Running safe local request...' : result.actual}</p>
            </div>
            <small>{status === 'idle' ? 'No wallet action requested' : result.evidenceRef}</small>
          </div>
        </article>
      ))}
      {status === 'error' ? <div className="evidenceWarning">{payload?.error ?? 'Boundary check failed.'}</div> : null}
    </div>
  );

  return (
    <section className={`panel boundaryCheckPanel ${compact ? 'boundaryCheckPanelCompact' : ''}`}>
      <div className="panelHeader">
        <div>
          <p className="eyebrow">Red-team boundary check</p>
          <h2 className="panelTitle">Deterministic boundary checks</h2>
        </div>
        <span className={`pill ${ok ? 'pillSuccess' : status === 'error' ? 'pillDanger' : 'pillWarn'}`}>
          {ok ? <ShieldCheck size={14} /> : <ShieldAlert size={14} />}
          {status === 'loading' ? 'Running' : ok ? '4 passed' : 'Safe local'}
        </span>
      </div>

      <div className={compact ? 'boundaryCheckSummary boundaryCheckSummaryCompact' : 'boundaryCheckSummary'}>
        <div>
          <span>Wallet signature</span>
          <strong>{payload?.walletSignatureRequested ? 'Requested' : 'No wallet required'}</strong>
        </div>
        <div>
          <span>Result</span>
          <strong>{summaryResult}</strong>
        </div>
        {!compact ? (
          <>
            <div>
              <span>Network cost</span>
              <strong>No signature, no gas, no Walrus payment</strong>
            </div>
            <div>
              <span>Execution mode</span>
              <strong>Safe local red-team request</strong>
            </div>
          </>
        ) : null}
      </div>

      {compact ? (
        <details className="boundaryCheckDrawer" open={status !== 'idle'}>
          <summary>{status === 'idle' ? 'Show four safe local checks' : 'Show check details'}</summary>
          {checkList}
        </details>
      ) : (
        checkList
      )}

      <button className="button buttonPrimary boundaryRefreshButton" type="button" onClick={() => void runChecks()} disabled={status === 'loading'}>
        <RefreshCw size={14} />
        {status === 'loading' ? 'Running checks' : 'Run checks'}
      </button>
    </section>
  );
}
