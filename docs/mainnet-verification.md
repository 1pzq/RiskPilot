# RiskPilot Mainnet Verification

Date: 2026-05-27
Workspace: `/Users/puzhiqiu/Practice/suiOverflow-2026`
Branch: `main`
Base commit tested: `45f18b7`
Scope: Sui mainnet wallet read, DeepBook evidence, Walrus archive, preview guards, browser smoke, and regression checks.

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
| Receipt package | `0x3f889b1dba8796715690b5b78f6bc7ca0f248a45368649b8116f982bda847b19` |

## Automated Verification

| Check | Result | Evidence / Notes |
| --- | --- | --- |
| `npm run lint` | PASS | ESLint completed with exit code 0. |
| `npm run typecheck` | PASS | `tsc --noEmit` completed with exit code 0. |
| `npm test` | PASS | 19 test files, 82 tests. |
| `npm run build` | PASS | Next.js 16.2.6 production build completed. |
| `git diff --check` | PASS | No whitespace errors. |
| Secret scan | PASS | No real key material found; only a test env var name was matched. |

## Browser Smoke

| Route | `localhost:3000` | `127.0.0.1:3000` | Notes |
| --- | --- | --- | --- |
| `/` | PASS | PASS | App shell rendered RiskPilot content. |
| `/?stage=risk&demo=judge#risk-dashboard` | PASS | PASS | Risk stage rendered. |
| `/?stage=strategy&demo=judge#risk-dashboard` | PASS | PASS | Strategy stage rendered. |
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
| Storage provider | `walrus-mainnet-cli` |
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
| Storage provider | `walrus-mainnet-cli` |
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

No connected-wallet prepare/archive click was performed in this report yet because it would trigger a new paid Walrus mainnet archive. That action should be confirmed at action time.

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
- Connected-wallet `Prepare and archive action` with user-confirmed Walrus storage spend.
- Live DeepBook Spot swap only if a wallet state produces an eligible `spot` SUI/USDC or USDC/SUI recommendation and the user explicitly confirms the wallet transaction.
