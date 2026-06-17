# RiskPilot Mainnet Verification

Date: 2026-05-27
Workspace: `/Users/puzhiqiu/Practice/Hackthon/suiOverflow-2026`
Branch: `main`
Base commit tested: `45f18b7`
Scope: Sui mainnet wallet read, DeepBook evidence, historical pre-wallet-paid Walrus archive, preview guards, browser smoke, and regression checks.

> Superseded boundary note, 2026-05-27: RiskPilot now requires wallet-paid Walrus archive. The old CLI evidence below is historical verification only; it is no longer an app runtime path. Current expected behavior is that `/api/audit` rejects server-side archive and Prepare asks the connected browser wallet to pay Walrus register/certify.

## Public Proof Excerpt

Use this as the short public proof card in README, submission materials, and judge demos.

| Field | Value |
| --- | --- |
| Verification date | `2026-05-27` |
| Audit id | `audit_1u99mb6` |
| Walrus blob | `ucjtVWMzIrYk2vczZpPGMexeJwQsendfrrb7_eQEizk` |
| Blob object | `0xdbf1058c9f842f3ae577735d9ce42a76769eee7d8bb5ba8a91d797c29e175cf2` |
| Register tx | `5PHtpzFqxz8jrXew23nW9QGmCekXNd714D7hCqpCJseS` |
| Certify tx | `GG6KB537teUvjKMjP4xpqeD4Dao2usQx62kKmVtE69AR` |
| Blob size | `35446` bytes |
| Status | Certified permanent Blob through epoch 32 |

```bash
walrus read ucjtVWMzIrYk2vczZpPGMexeJwQsendfrrb7_eQEizk --out /tmp/riskpilot-walrus-read.json
walrus blob-status --blob-id ucjtVWMzIrYk2vczZpPGMexeJwQsendfrrb7_eQEizk
```

## Secret Redaction

Confirmed: this report does not include private keys, seed phrases, mnemonics, full API keys, provider tokens, proxy secrets, wallet secrets, or `.env.local` contents.

Public chain identifiers such as wallet addresses, transaction digests, object ids, and Walrus blob ids may be recorded.

## Environment

| Item | Result |
| --- | --- |
| Sui network | `mainnet` |
| Sui RPC | `https://fullnode.mainnet.sui.io:443` |
| Sui CLI | `/Users/puzhiqiu/.local/bin/sui`, `sui 1.72.2-85b460a63fd7` |
| Sui active env | `mainnet` |
| Sui active CLI address | `0x69bb839c43b5062487b00b5efa10c6d4914e2036a8c71cea8ce92002e12a8508` |
| Walrus CLI | `/Users/puzhiqiu/.local/bin/walrus`, `walrus 1.48.1-9c5590a81e29` |
| Walrus context | `mainnet` |
| Execution default | `prepare_mainnet` / prepare-only mainnet |
| AgentPolicy + receipt package | `0x24972ef5274a577127dc871687e4bfe4bb4d512d810c025cbe01d87ca621c2d7` |

## AgentPolicy Mainnet Evidence

The bounded-agent authority package was published to Sui mainnet and smoke-tested with a real `AgentPolicy` object.

| Field | Value |
| --- | --- |
| Package id | `0x24972ef5274a577127dc871687e4bfe4bb4d512d810c025cbe01d87ca621c2d7` |
| Modules | `agent_policy`, `strategy_receipt` |
| Publish tx | `sgoT9HA2bFSUmX3Smx7L4zkianb5UQbVJJE7eMcg5se` |
| UpgradeCap | `0xd2b3e7db4b29ec48a23eedbe9854881d79afa9e9a6c871270efe70e0bfc8ec79` |
| Publish cost | `0.01771148 SUI` |
| AgentPolicy object | `0xf71d26a3f7f72bb0185e787d1857529765c1a59155195281f3b31ada1f923f87` |
| AgentPolicy mint tx | `6tPgwgKnYjHSZV4n6dd4p7jucRGLdGySEdVFK2HD82LQ` |
| Mint cost | `0.00219228 SUI` |
| Owner | `0x69bb839c43b5062487b00b5efa10c6d4914e2036a8c71cea8ce92002e12a8508` |
| Allowed market | `SUI/USDC` |
| Allowed assets | `SUI`, `USDC` |
| Max budget | `5 USD` |
| Requires manual approval | `true` |
| Revoked | `false` |

## Automated Verification

| Check | Result | Evidence / Notes |
| --- | --- | --- |
| `npm run lint` | PASS | ESLint completed with exit code 0. |
| `npm run typecheck` | PASS | `tsc --noEmit` completed with exit code 0. |
| `npm test` | PASS | 19 test files, 81 tests. |
| `npm run build` | PASS | Next.js 16.2.6 production build completed. |
| `git diff --check` | PASS | No whitespace errors. |
| Secret scan | PASS | No real key material found; only a test env var name was matched. |

## Browser Smoke

| Route | `localhost:3000` | `127.0.0.1:3000` | Notes |
| --- | --- | --- | --- |
| `/` | PASS | PASS | App shell rendered RiskPilot content. |
| `/?stage=risk#risk-dashboard` | PASS | PASS | Risk stage reachable; without a wallet it shows the connection-required proof/boundary view. |
| `/?stage=strategy#risk-dashboard` | PASS | PASS | Strategy stage reachable; without a wallet it shows the connection-required proof/boundary view. |
| `/?stage=audit#risk-dashboard` | PASS | PASS | Audit stage rendered. |
| `/?stage=prepare#risk-dashboard` | PASS | PASS | Prepare stage rendered. |

## DeepBook Mainnet Evidence

`/api/deepbook-market?poolKey=SUI_USDC` returned a live mainnet market snapshot.

| Field | Result |
| --- | --- |
| Pool key | `SUI_USDC` |
| Pool address | `0xe05dafb5133bcffb8d59f4e12465dc0e9faeaa05e3e342a08fe135800e3e4407` |
| Base / quote | `SUI` / `USDC` |
| Registered pool | `true` |
| Whitelisted | `false` / open |
| Mid price sample | about `0.995` USDC per SUI during the test window |
| Evidence status | `ready` |

DeepBook live Spot behavior was also checked in the connected wallet UI. The current connected wallet produced a DeepBook Predict-style prepare-only recommendation, so `Live Spot mainnet` was correctly disabled. No live Spot transaction was submitted in this pass.

## Walrus Mainnet Evidence

### Full UI Prepare Archive

The Prepare page successfully archived the judge-mode audit package through Walrus mainnet CLI before the permanent-storage patch.

| Field | Result |
| --- | --- |
| Audit id | `audit_aw9pyh` |
| Prepared id | `prep_1kebs9h` |
| Historical storage provider | pre-wallet-paid CLI probe |
| Current archive payer/signer expectation | Connected wallet |
| Blob id | `U5zAF1mDIVr0eM4nMe1gdWL5lqoVweJDZ-YTESFcL2s` |
| Fallback used | No |
| Readback | PASS with `walrus read --context mainnet --skip-consistency-check` |
| Default status/read | WARN: quorum/deletable status was not verifiable |

Readback JSON included `walletAddress`, `execution`, `deepbookMarketEvidence`, `agentCouncil`, and `incidentRoom`. DeepBook evidence was ready for `SUI_USDC`.

### Permanent Walrus Probe

After the Walrus CLI archive path was changed to use `--permanent`, a small mainnet audit probe was archived and verified with default Walrus consistency checks.

| Field | Result |
| --- | --- |
| Audit id | `audit_permanent_probe_1779873575030` |
| Execution digest | `prep_permanent_probe` |
| Historical storage provider | pre-wallet-paid CLI probe |
| Current archive payer/signer expectation | Connected wallet |
| Blob id | `8dz45tQS48HQ54shZz2u1ncPrH9DnCue0VcpRMmrJL0` |
| Fallback used | No |
| `walrus read --context mainnet` | PASS |
| `walrus blob-status --context mainnet --blob-id ... --json` | PASS |
| Certified status | `permanent`, `isCertified: true`, `endEpoch: 32` |
| Status tx digest | `34SXDY9ZQqraYzP6p4QjxS4Sxe4skL6R9ksDEDdPweZw` |
| Estimated expiry | `2026-06-02T15:07:28.171Z` |

Conclusion: permanent Walrus storage gives stronger judge-facing verification than the default deletable blob path.

## Connected Wallet Manual Verification

Checked in Google Chrome with Slush available.

| Check | Result |
| --- | --- |
| Wallet connected | PASS, shown as `Connected 0xc495...8e94` |
| Live balances displayed | PASS, 3 mainnet balance rows |
| Tracked value | `$24.87` |
| Owned objects scanned | PASS, 34 objects |
| Protocol hints | PASS, 1 DeFi candidate |
| Unknown/unpriced coins | PASS, SPAM shown without USD value |
| Scenario cards hidden after connect | PASS |
| Synthetic lending/LP rows cleared | PASS |
| Risk stage | PASS, score `42/100`, 2 active signals |
| Strategy stage | PASS, DeepBook Predict-style prepare-only recommendation |
| Live Spot button | PASS, disabled because current route is not eligible Spot SUI/USDC |

Connected-wallet prepare/archive was triggered after the wallet-paid boundary fix. First attempt: the connected wallet paid Walrus register tx `BTgDrrjDPcoeBbzu2UA1T2BaHphx3GUYy49NFYTEX4cf`, which emitted `BlobRegistered` for object `0x5e6de65cdfa35bd9ec5de1e1aca9559caec9b7f566eea4695ff9a97c5ace89fa`; the browser then lost the `signAndExecute` response before upload/certify, verifying payer boundary but not a completed archive.

After adding register/certify response-loss recovery, `Prepare and wallet-paid archive` was re-triggered with the same connected wallet and completed successfully:

| Field | Value |
| --- | --- |
| Audit id | `audit_1u99mb6` |
| Walrus blob | `ucjtVWMzIrYk2vczZpPGMexeJwQsendfrrb7_eQEizk` |
| Blob object | `0xdbf1058c9f842f3ae577735d9ce42a76769eee7d8bb5ba8a91d797c29e175cf2` |
| Register tx | `5PHtpzFqxz8jrXew23nW9QGmCekXNd714D7hCqpCJseS` |
| Certify tx | `GG6KB537teUvjKMjP4xpqeD4Dao2usQx62kKmVtE69AR` |
| Register cost | `6821092` MIST SUI and `6380451` WAL from connected wallet |
| Certify cost | `202040` MIST SUI from connected wallet |
| Blob size | `35446` bytes |
| Status | certified permanent Blob through epoch 32 |

Readback verification:

```bash
walrus read ucjtVWMzIrYk2vczZpPGMexeJwQsendfrrb7_eQEizk --out /tmp/riskpilot-walrus-read.json
walrus blob-status --blob-id ucjtVWMzIrYk2vczZpPGMexeJwQsendfrrb7_eQEizk
```

`walrus read` reconstructed the audit JSON and `walrus blob-status` reported the related event tx `GG6KB537teUvjKMjP4xpqeD4Dao2usQx62kKmVtE69AR`.

## Safety Boundary Checks

| Boundary | Result |
| --- | --- |
| Default mode remains Prepare mainnet | PASS |
| Live DeepBook Spot is opt-in only | PASS |
| Connected wallet uses real mainnet rows only | PASS |
| Unknown/unpriced assets do not invent trades | PASS |
| What-if remains preview-only | PASS |
| `/api/execute` rejects preview payloads | PASS, HTTP 400 |
| `/api/audit` rejects preview payloads | PASS, HTTP 400 |
| AI fallback does not block core flow | PASS by existing regression coverage |
| Audit Package Explorer reads real archive result only | PASS in UI archived package |

## Code Changes From Verification

- Walrus CLI storage now uses `--permanent` so future audit packages are non-deletable until expiry and easier to verify with default Walrus consistency checks.
- Added a regression test asserting the permanent Walrus CLI arguments.
- Added extra frontend long-text wrapping for warning strips, evidence chips, Agent Council, and Incident Room text surfaces.
- Superseded by the wallet-paid boundary fix: current UI labels Walrus archive payer/signer as the connected wallet.

## Final Assessment

Submission readiness: **yes, with one optional remaining manual action**.

Passed:
- Sui mainnet environment and connected-wallet read path.
- DeepBook mainnet market evidence.
- Walrus mainnet archive and permanent blob verification.
- What-if preview guards.
- Browser smoke on local hostnames.
- Full lint/typecheck/test/build regression.

Remaining optional checks:
- Live DeepBook Spot swap only if a wallet state produces an eligible `spot` SUI/USDC or USDC/SUI recommendation and the user explicitly confirms the wallet transaction.
