import { describe, expect, it } from 'vitest';

describe('boundary check route', () => {
  it('runs safe local red-team checks without wallet signatures', async () => {
    const { GET } = await import('@/app/api/boundary-check/route');

    const response = await GET();
    const payload = (await response.json()) as {
      ok: boolean;
      walletSignatureRequested: boolean;
      results: { id: string; passed: boolean; actual: string }[];
    };

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.walletSignatureRequested).toBe(false);
    expect(payload.results).toHaveLength(4);
    expect(payload.results.map((result) => result.id)).toEqual([
      'execute-preview-rejection',
      'audit-preview-rejection',
      'policy-blocked-execution',
      'ai-posture-lock',
    ]);
    expect(payload.results.every((result) => result.passed)).toBe(true);
    expect(payload.results[0].actual).toContain('HTTP 400');
  });
});
