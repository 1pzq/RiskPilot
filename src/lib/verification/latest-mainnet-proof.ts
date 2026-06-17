export type MainnetProof = {
  verifiedAt: string;
  auditId: string;
  blobId: string;
  blobObjectId: string;
  registerTx: string;
  certifyTx: string;
  blobSizeBytes: number;
  checksum?: string;
  readbackUrl: string;
  walrusReadCommand: string;
  walrusStatusCommand: string;
  source: 'latest_verified_sample' | 'current_session_archive';
};

export const LATEST_MAINNET_PROOF: MainnetProof = {
  verifiedAt: '2026-05-27',
  auditId: 'audit_1u99mb6',
  blobId: 'ucjtVWMzIrYk2vczZpPGMexeJwQsendfrrb7_eQEizk',
  blobObjectId: '0xdbf1058c9f842f3ae577735d9ce42a76769eee7d8bb5ba8a91d797c29e175cf2',
  registerTx: '5PHtpzFqxz8jrXew23nW9QGmCekXNd714D7hCqpCJseS',
  certifyTx: 'GG6KB537teUvjKMjP4xpqeD4Dao2usQx62kKmVtE69AR',
  blobSizeBytes: 35446,
  readbackUrl: 'https://aggregator.mainnet.walrus.space/v1/blobs/ucjtVWMzIrYk2vczZpPGMexeJwQsendfrrb7_eQEizk',
  walrusReadCommand:
    'walrus read ucjtVWMzIrYk2vczZpPGMexeJwQsendfrrb7_eQEizk --out /tmp/riskpilot-walrus-read.json',
  walrusStatusCommand:
    'walrus blob-status --blob-id ucjtVWMzIrYk2vczZpPGMexeJwQsendfrrb7_eQEizk',
  source: 'latest_verified_sample',
};
