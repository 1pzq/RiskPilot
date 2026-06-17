import { describe, expect, it } from 'vitest';

import {
  executeDeepBookTransaction,
  executionModeFromEnvironment,
  prepareDeepBookTransaction,
  type DeepBookExecutionRequest,
} from '../lib/sui/deepbook';

const request: DeepBookExecutionRequest = {
  kind: 'predict_binary',
  market: 'SUI downside -10% / 7D',
  side: 'buy',
  assetIn: 'USDC',
  assetOut: 'SUI downside cover',
  amountUsd: 5,
};

describe('DeepBook adapter', () => {
  it('prepares mainnet requests without submitting funds', () => {
    const result = prepareDeepBookTransaction(request, '0xDEMO');

    expect(result.mode).toBe('prepare_mainnet');
    expect(result.status).toBe('prepared');
    expect(result.adapter.venue).toBe('DeepBook Predict mainnet');
    expect(result.adapter.mainnetOnly).toBe(true);
    expect(result.transactionBytes).toMatch(/^0x/u);
    expect(result.authority).toEqual(
      expect.objectContaining({
        signer: 'none',
        payer: 'none',
        signerLabel: '无钱包签名',
        payerLabel: '无链上付款',
      }),
    );
  });

  it('normalizes environment execution mode safely', () => {
    expect(executionModeFromEnvironment(undefined)).toBe('prepare_mainnet');
    expect(executionModeFromEnvironment('prepare')).toBe('prepare_mainnet');
    expect(executionModeFromEnvironment('live')).toBe('mainnet');
    expect(executionModeFromEnvironment('simulation')).toBe('prepare_mainnet');
    expect(executionModeFromEnvironment('simulate')).toBe('prepare_mainnet');
  });

  it('falls back to preparation when live mainnet submission is requested', async () => {
    await expect(
      executeDeepBookTransaction(request, '0xDEMO', {
        requestedMode: 'mainnet',
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        mode: 'prepare_mainnet',
        status: 'prepared',
        warning: expect.stringContaining('准备 mainnet 动作'),
      }),
    );
  });
});
