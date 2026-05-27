# RiskPilot Runtime State

Read this first before changing Sui, Walrus, wallet, execution, AI, or cleanup-related files.

Last handoff update: 2026-05-27 after wallet-paid Walrus archive verification and Walrus wasm dynamic-loading fix.

## Do Not Reset

- Do not run `sui client new-env`.
- Do not delete or overwrite `~/.sui/sui_config/client.yaml`.
- Do not delete or overwrite `~/.config/walrus/client_config.yaml`.
- Do not reimport or reinitialize any chain account unless the user explicitly asks for a reset.
- Do not switch back to testnet/devnet.
- Do not make live execution the default.
- Do not write private keys, seed phrases, provider keys, proxy secrets, `.env.local` contents, or wallet secrets into repo files, docs, screenshots, commits, or logs.
- Before any Sui or Walrus command, confirm the matching config file exists first.

## Current Product Truth

- Primary Sui Overflow 2026 track narrative: **Agentic Web**.
- Sui mainnet, DeepBook, Walrus, and optional StrategyReceipt are supporting proof rails.
- App stages: Overview -> Risk -> Strategy -> Audit -> Prepare.
- Judge mode works disconnected through curated scenarios and One-click Judge Demo Mode.
- Connected-wallet mode reads real Sui mainnet balances and owned objects, hides scenario cards, clears synthetic demo lending/LP positions, and does not invent trades from unknown or unpriced coins.
- Default execution mode is `prepare_mainnet`.
- Live DeepBook is explicit opt-in only, gated to eligible spot SUI/USDC or USDC/SUI routes, and requires wallet approval.
- DeepBook Predict-style protection remains prepare-only.
- Walrus archive is connected-wallet signed and paid. The browser wallet signs Walrus register/certify and pays required SUI/WAL costs.
- The browser Walrus archive module is dynamically imported only when Prepare/archive is clicked; do not top-level import `@mysten/walrus` from the app shell.
- Browser Walrus encoding must use the web wasm URL from `NEXT_PUBLIC_WALRUS_WASM_URL`; otherwise Next/Turbopack can resolve the Node.js wasm entry and throw `ENOENT ... walrus_wasm_bg.wasm`.
- Server-side Walrus archive is disabled. `/api/audit` returns a hard error and must not be used as a backend payer path.
- The old off-browser Walrus payer path is historical only and has been removed from the app runtime.
- StrategyReceipt mint is optional and post-archive. It is not proof of automatic trade execution.
- Optional StrategyReceipt minting is connected-wallet signed and paid only when the user clicks mint.

## Implemented Surfaces

- Wallet source panel and connected-wallet portfolio scanner.
- Deterministic risk score and signal breakdown.
- What-if Risk Simulator.
- What-if Strategy Diff.
- Policy Gate.
- Strategy recommendation / DeepBook evidence.
- Agentic Incident Room.
- Agent Council.
- Evidence Timeline.
- Monitor mode.
- Audit Package Explorer.
- Prepare/archive flow.
- Optional StrategyReceipt mint.

## Safety Boundaries

- AI explains; deterministic rules decide.
- AI-backed mode may improve explanations, Incident Room briefing/findings, deliberation wording, and Manager summaries.
- AI must not override `policyCheck`, DeepBook eligibility, action bounds, Incident Room final commands, handoffs, archive behavior, receipt state, or execution mode.
- If provider config is missing or the provider call fails, use deterministic fallback text and continue the core Sui/Walrus flow.
- What-if is estimated preview data only. It must not mutate the base portfolio and must not replace real prepare/archive, Walrus payloads, receipt mint, or live execution data.
- `/api/execute` and `/api/audit` must reject `previewOnly` or `source: what_if_preview` markers.
- Audit Package Explorer must render only from real `auditPackage && auditStorage`; it must not read simulated What-if state as the real archive source.
- UI must distinguish subject wallet, wallet signer, action payer, and Walrus archive payer. Every paid chain action must be signed and paid by the connected wallet.

## Current Mainnet Environment

- Sui active env: `mainnet`
- Sui active alias: `riskpilot-mainnet`
- Sui active address: `0x69bb839c43b5062487b00b5efa10c6d4914e2036a8c71cea8ce92002e12a8508`
- Sui CLI path/version: `/Users/puzhiqiu/.local/bin/sui`, `sui 1.72.2-85b460a63fd7`
- Sui RPC: `https://fullnode.mainnet.sui.io:443`
- Walrus config: `~/.config/walrus/client_config.yaml`
- Walrus default context: `mainnet`
- Walrus CLI path/version: `/Users/puzhiqiu/.local/bin/walrus`, `walrus 1.48.1-9c5590a81e29`
- Last verified Walrus blob from browser prepare/archive smoke test: `fYbZaxhANwoma1ZRxqm8VWL1bMByeg8CkiMKRxtmeCY`
- Latest verified permanent Walrus probe blob: `8dz45tQS48HQ54shZz2u1ncPrH9DnCue0VcpRMmrJL0`
- Latest permanent Walrus probe status tx: `34SXDY9ZQqraYzP6p4QjxS4Sxe4skL6R9ksDEDdPweZw`
- Last receipt mint smoke tx: `Fui3ESVAtzsVwe55tPGE4VirWgouVw68o7kGH7X6woqP`
- Last receipt mint smoke object: `0x3c0b842ee005037d79f534c396da96eebb614ee37fd2aeb65ff8fbac64a6fd4b`

## Current Project Defaults

- `NEXT_PUBLIC_SUI_NETWORK=mainnet`
- `NEXT_PUBLIC_SUI_RPC_URL=https://fullnode.mainnet.sui.io:443`
- `NEXT_PUBLIC_MAINNET_EXECUTION_MODE=prepare`
- `NEXT_PUBLIC_ENABLE_DEEPBOOK_REAL=true`
- `NEXT_PUBLIC_WALRUS_UPLOAD_RELAY_URL=https://upload-relay.mainnet.walrus.space`
- `NEXT_PUBLIC_WALRUS_UPLOAD_RELAY_MAX_TIP_MIST=10000000`
- `NEXT_PUBLIC_WALRUS_WASM_URL=https://unpkg.com/@mysten/walrus-wasm@0.2.2/web/walrus_wasm_bg.wasm`
- `NEXT_PUBLIC_RECEIPT_PACKAGE_ID=0x3f889b1dba8796715690b5b78f6bc7ca0f248a45368649b8116f982bda847b19`
- Committed AI examples stay provider-neutral and blank-key by default.
- Local demo provider configuration belongs only in `.env.local`; never copy secret values into docs, source, screenshots, commits, or chat logs.

## Documentation Map

- `README.md`: public project entry, quick start, safety defaults, structure, latest verification expectations.
- `docs/judge-walkthrough.md`: canonical 30-second / 3-minute judge demo script.
- `docs/mainnet-verification.md`: latest mainnet verification report and evidence.
- `docs/project-introduction.md`: bilingual pitch and product explanation.
- `docs/runtime-state.md`: maintainer handoff only.
- `move/README.md`: optional StrategyReceipt package notes.

## Latest Cleanup Summary

- Removed legacy `docs/项目的展望.docx`; it was a historical DeepBook-first / testnet planning draft and conflicted with the current Agentic Web, mainnet, prepare-only narrative.
- Removed tracked root `tsconfig.tsbuildinfo`; TypeScript incremental cache now writes to `.next/cache/tsconfig.tsbuildinfo`, which is ignored.
- Removed unused direct dependencies from `package.json`: `@eslint/eslintrc`, `recharts`, and `zustand`.
- Removed unused helper exports: `PolicyInput`, `policyToInput`, `inputToPolicy`, `toDatetimeLocalValue`, `fromDatetimeLocalValue`, `MAINNET_NETWORK`, `mergeWalletSuiBalance`, `readMainnetSuiBalance`, and `describePortfolioSource`.
- Cleaned stale frontend CSS selectors for old `mainGrid`, `leftColumn`, `rightColumn`, `resultDetails`, and nav button variants.
- Added explicit pending Evidence Timeline styling.
- Updated README and project introduction so docs no longer duplicate long implementation history.
- Updated `move/README.md` to clarify that StrategyReceipt is optional post-archive proof, not proof of automatic execution.

## Latest Mainnet Verification Summary

- Automated checks passed after verification changes: `npm run lint`, `npm run typecheck`, `npm test` (19 files / 81 tests), `npm run build`, `git diff --check`, and heuristic secret scan.
- DeepBook mainnet `SUI_USDC` market evidence returned a registered pool at `0xe05dafb5133bcffb8d59f4e12465dc0e9faeaa05e3e342a08fe135800e3e4407`.
- UI prepare/archive successfully produced Walrus mainnet blob `U5zAF1mDIVr0eM4nMe1gdWL5lqoVweJDZ-YTESFcL2s` for audit `audit_aw9pyh`; this pre-permanent blob required `walrus read --skip-consistency-check` because default status verification hit a deletable/quorum warning.
- Walrus CLI storage was changed to `--permanent`; permanent probe blob `8dz45tQS48HQ54shZz2u1ncPrH9DnCue0VcpRMmrJL0` passed default `walrus read` and `walrus blob-status`, with certified status tx `34SXDY9ZQqraYzP6p4QjxS4Sxe4skL6R9ksDEDdPweZw`.
- Connected-wallet Chrome verification passed for address `0xc495...8e94`: 3 balance rows, 34 owned objects, 1 DeFi candidate, no synthetic lending/LP insertion, unpriced SPAM did not create an invented trade.
- Current connected wallet produced a DeepBook Predict-style prepare-only recommendation; `Live Spot mainnet` was correctly disabled because the route was not eligible spot SUI/USDC.
- Wallet-paid boundary fix: Prepare now requires a connected Sui mainnet wallet before archive; Walrus archive uses the browser wallet flow and returns `provider: walrus-mainnet-wallet`.
- Wallet-paid mainnet attempt reached the Walrus upload relay tip guard; default max relay tip is now `10000000` MIST so the required `2579480` MIST relay tip can proceed to wallet signing.
- Connected-wallet register transaction `BTgDrrjDPcoeBbzu2UA1T2BaHphx3GUYy49NFYTEX4cf` succeeded on mainnet for wallet `0xc495...8e94`, spending `6821092` MIST SUI and `6380451` WAL. The browser lost the `signAndExecute` response before upload/certify, so no completed archive was recorded from that attempt.
- Wallet archive recovery patch now catches recoverable register/certify response-loss errors. Register recovery queries recent mainnet `BlobRegistered` events for the encoded blob id and size; certify recovery checks Walrus/Sui blob object state before marking the archive failed.
- Re-triggered `Prepare and wallet-paid archive` completed successfully through the connected wallet. Audit `audit_1u99mb6` archived to Walrus blob `ucjtVWMzIrYk2vczZpPGMexeJwQsendfrrb7_eQEizk`, blob object `0xdbf1058c9f842f3ae577735d9ce42a76769eee7d8bb5ba8a91d797c29e175cf2`, register tx `5PHtpzFqxz8jrXew23nW9QGmCekXNd714D7hCqpCJseS`, and certify tx `GG6KB537teUvjKMjP4xpqeD4Dao2usQx62kKmVtE69AR`.
- The certified blob is permanent until epoch 32. `walrus read --out /tmp/riskpilot-walrus-read.json` reconstructed 35446 bytes; `walrus blob-status --blob-id ucjtVWMzIrYk2vczZpPGMexeJwQsendfrrb7_eQEizk` reports the related certify event `GG6KB537teUvjKMjP4xpqeD4Dao2usQx62kKmVtE69AR`.
- Walrus wasm runtime fix: `riskpilot-app.tsx` dynamically imports the wallet archive helper at click time, and `wallet-archive.ts` passes `NEXT_PUBLIC_WALRUS_WASM_URL` to `WalrusClient`. This avoids the Next/Turbopack runtime error that tried to open `/ROOT/node_modules/@mysten/walrus-wasm/nodejs/walrus_wasm_bg.wasm`. Browser reload of `/?stage=prepare#risk-dashboard` showed no runtime overlay and the Prepare button rendered.
- `/api/audit` now rejects ordinary archive payloads because server-side Walrus payment is disabled; What-if preview payloads still reject with HTTP 400.
- Live DeepBook Spot and StrategyReceipt mint both pass `chain: sui:mainnet` to wallet signing.

## Verification Expectations

Run before final handoff after cleanup or feature work:

```bash
npm run lint
npm run typecheck
npm test
npm run build
git diff --check
```

Also run a secret scan before sharing or committing. Browser smoke should cover:

- `http://localhost:3000/`
- `http://localhost:3000/?stage=risk&demo=judge#risk-dashboard`
- `http://localhost:3000/?stage=strategy&demo=judge#risk-dashboard`
- `http://localhost:3000/?stage=audit#risk-dashboard`
- `http://localhost:3000/?stage=prepare#risk-dashboard`
- The same key stage links on `127.0.0.1:3000`

Connected-wallet manual verification has passed previously in a normal wallet-capable browser. Automation browsers may not expose Slush/provider popups.

## Optional Later

- Split `riskpilot-app.tsx` into smaller stage render components after the submission is stable.
- Consider splitting `globals.css` into base, shell, shared UI, stage layout, feature panels, and responsive sections.
- Add wallet stress tests for many assets/protocol hints/objects if time allows.
- Enable live DeepBook execution only for eligible spot SUI/USDC swaps and only if the team intentionally wants a live demo.
- Add Walrus production gateway/auth if this grows beyond hackathon demo mode.
