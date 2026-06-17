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
    label: '/api/execute 拒绝 What-if 预览 payload',
    expected: 'HTTP 400；不会准备执行',
    actual: '点击运行检查，提交安全的本地请求。',
    passed: false,
    evidenceRef: '/api/execute preview guard',
  },
  {
    id: 'audit-preview-rejection',
    label: '/api/audit 拒绝 What-if 预览 payload',
    expected: 'HTTP 400；不会接受归档包',
    actual: '点击运行检查，提交安全的本地请求。',
    passed: false,
    evidenceRef: '/api/audit preview guard',
  },
  {
    id: 'policy-blocked-execution',
    label: '超预算 Policy 会被阻断',
    expected: '执行准备前返回 HTTP 400',
    actual: '点击运行检查，提交一个超预算 Policy。',
    passed: false,
    evidenceRef: 'validateExecutionPolicy',
  },
  {
    id: 'ai-posture-lock',
    label: 'AI 文案不能改变最终姿态',
    expected: '恶意措辞被忽略；确定性最终指令仍保持仅 Prepare',
    actual: '点击运行检查，对比 AI 文案和锁定的最终指令。',
    passed: false,
    evidenceRef: 'incidentRoom.finalCommand',
  },
];

function failedBoundaryPayload(error: unknown): BoundaryCheckResponse {
  return {
    ok: false,
    walletSignatureRequested: false,
    results: [],
    error: error instanceof Error ? error.message : '边界检查失败。',
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
      ? '等待评审点击'
      : ok
        ? '4 项检查通过'
        : status === 'error'
          ? '检查失败'
        : '正在运行检查';
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
                  ? '就绪'
                  : status === 'loading'
                    ? '运行中'
                    : result.passed
                      ? 'PASS'
                      : 'FAIL'}
              </em>
            </div>
            <div className="boundaryExpectationGrid">
              <span>预期</span>
              <p>{result.expected}</p>
              <span>实际</span>
              <p>{status === 'loading' ? '正在运行安全本地请求...' : result.actual}</p>
            </div>
            <small>{status === 'idle' ? '不会请求钱包动作' : result.evidenceRef}</small>
          </div>
        </article>
      ))}
      {status === 'error' ? <div className="evidenceWarning">{payload?.error ?? '边界检查失败。'}</div> : null}
    </div>
  );

  return (
    <section className={`panel boundaryCheckPanel ${compact ? 'boundaryCheckPanelCompact' : ''}`}>
      <div className="panelHeader">
        <div>
          <p className="eyebrow">红队边界检查</p>
          <h2 className="panelTitle">确定性边界检查</h2>
        </div>
        <span className={`pill ${ok ? 'pillSuccess' : status === 'error' ? 'pillDanger' : 'pillWarn'}`}>
          {ok ? <ShieldCheck size={14} /> : <ShieldAlert size={14} />}
          {status === 'loading' ? '运行中' : ok ? '4 项通过' : '安全本地'}
        </span>
      </div>

      <div className={compact ? 'boundaryCheckSummary boundaryCheckSummaryCompact' : 'boundaryCheckSummary'}>
        <div>
          <span>钱包签名</span>
          <strong>{payload?.walletSignatureRequested ? '已请求' : '无需钱包'}</strong>
        </div>
        <div>
          <span>结果</span>
          <strong>{summaryResult}</strong>
        </div>
        {!compact ? (
          <>
            <div>
              <span>网络成本</span>
              <strong>无签名、无 gas、无 Walrus 付款</strong>
            </div>
            <div>
              <span>执行模式</span>
              <strong>安全本地红队请求</strong>
            </div>
          </>
        ) : null}
      </div>

      {compact ? (
        <details className="boundaryCheckDrawer" open={status !== 'idle'}>
          <summary>{status === 'idle' ? '显示四项安全本地检查' : '显示检查详情'}</summary>
          {checkList}
        </details>
      ) : (
        checkList
      )}

      <button className="button buttonPrimary boundaryRefreshButton" type="button" onClick={() => void runChecks()} disabled={status === 'loading'}>
        <RefreshCw size={14} />
        {status === 'loading' ? '正在运行检查' : '运行检查'}
      </button>
    </section>
  );
}
