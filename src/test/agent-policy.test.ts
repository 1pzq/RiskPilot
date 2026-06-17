import { describe, expect, it } from 'vitest';

import {
  buildAgentPolicyObjectFromPolicy,
  buildCreateAgentPolicyTransaction,
  extractAgentPolicyObjectId,
  validateAgentPolicyObject,
} from '@/lib/sui/agent-policy';
import { createDemoPortfolio } from '@/lib/risk/fixtures';
import { calculateRiskReport } from '@/lib/risk/risk-engine';
import { createDefaultPolicy } from '@/lib/strategy/policy';
import { buildStrategyRecommendation } from '@/lib/strategy/strategy-builder';

const PACKAGE_ID = '0x3f889b1dba8796715690b5b78f6bc7ca0f248a45368649b8116f982bda847b19';

function buildContext() {
  const now = new Date('2026-05-20T00:00:00.000Z');
  const portfolio = createDemoPortfolio('0xDEMO', { timestamp: now.toISOString() });
  const riskReport = calculateRiskReport(portfolio);
  const recommendation = buildStrategyRecommendation(riskReport, portfolio, { maxBudgetUsd: 5 }, { defaultBudgetUsd: 5, now });
  const policy = createDefaultPolicy(recommendation, now);
  const policyObject = buildAgentPolicyObjectFromPolicy({
    objectId: '0xpolicy',
    owner: '0xowner',
    policy,
    packageId: PACKAGE_ID,
  });

  return { now, policy, policyObject, recommendation };
}

describe('agent policy helpers', () => {
  it('requires a package id before building a mint transaction', () => {
    const { policy } = buildContext();

    expect(() => buildCreateAgentPolicyTransaction({ policy, packageId: '' })).toThrow(
      'NEXT_PUBLIC_AGENT_POLICY_PACKAGE_ID',
    );
  });

  it('extracts the created AgentPolicy object id from transaction object changes', () => {
    const objectId = extractAgentPolicyObjectId(
      [
        {
          type: 'created',
          sender: '0xsender',
          owner: { AddressOwner: '0xsender' },
          objectId: '0xpolicy',
          objectType: `${PACKAGE_ID}::agent_policy::AgentPolicy`,
          version: '1',
          digest: 'object_digest',
        },
      ],
      PACKAGE_ID,
    );

    expect(objectId).toBe('0xpolicy');
  });

  it('accepts a policy object that matches the current recommendation bounds', () => {
    const { now, policy, policyObject, recommendation } = buildContext();

    expect(validateAgentPolicyObject(policyObject, policy, recommendation, now)).toMatchObject({
      ok: true,
      status: 'minted',
      errors: [],
    });
  });

  it('blocks expired and mismatched policy objects', () => {
    const { policy, policyObject, recommendation } = buildContext();

    expect(
      validateAgentPolicyObject(
        {
          ...policyObject,
          expiresAt: '2026-05-19T00:00:00.000Z',
        },
        policy,
        recommendation,
        new Date('2026-05-20T00:00:00.000Z'),
      ),
    ).toMatchObject({
      ok: false,
      status: 'expired',
    });

    expect(
      validateAgentPolicyObject(
        {
          ...policyObject,
          allowedMarkets: ['OTHER/USDC'],
        },
        policy,
        recommendation,
        new Date('2026-05-20T00:00:00.000Z'),
      ),
    ).toMatchObject({
      ok: false,
      status: 'mismatch',
    });
  });
});
