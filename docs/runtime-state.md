# RiskPilot Runtime State

Read this first. Do not repeat anything marked as already done.

Last handoff update: 2026-05-22 after focused connected-wallet validation attempt.

## Do Not Reset

- Do not run `sui client new-env`.
- Do not delete or overwrite `~/.sui/sui_config/client.yaml`.
- Do not delete or overwrite `~/.config/walrus/client_config.yaml`.
- Do not reimport or reinitialize any chain account unless the user explicitly asks for a reset.
- Do not import a private key if the existing mainnet config is present.
- Do not write private keys, seed phrases, or proxy secrets into repo files, docs, screenshots, commits, or logs.
- Before any Sui or Walrus command, confirm the matching config file exists first.

## Already Verified

- App shell and 5-stage dashboard UI are in place.
- Demo scenarios, wallet reads, risk engine, strategy builder, and policy checks work.
- DeepBook mainnet prepare-only flow is the default.
- Live DeepBook is optional and only for eligible spot SUI/USDC swaps.
- Walrus mainnet audit upload and local fallback work.
- Slush wallet support is enabled through `WalletProvider.slushWallet`.
- Wallet connect modal is fixed: `@mysten/dapp-kit/dist/index.css` is imported in `src/app/layout.tsx`, and `WalletConnectButton` controls `ConnectModal.open` explicitly.
- Slush wallet connection is fixed and the first manual browser click-through passed after the fix.
- Connected wallet mode is real-wallet-first: demo scenario selector is hidden, visible assets come only from mainnet coin balances, demo lending/LP positions are cleared, unknown/spam coins are unpriced, and no fallback strategy invents a USDC/SUI trade when the wallet has no priced actionable risk.
- Strategy receipt Move package is published on Sui mainnet.
- Strategy receipt mint smoke test passed on Sui mainnet.
- AI explain endpoint supports OpenAI-compatible gateways through the Responses API, is configured for live calls in `.env.local`, and still works with mock fallback.
- OpenAI live explanation smoke test passed: `/api/explain` returned `mode: openai` with no warning.
- Walrus audit packages now include `deepbookMarketEvidence` with DeepBook snapshot source/status, route status, snapshot wallet address, pool key/address, base/quote assets, mid price, vault/order parameters, derived labels, `fetchedAt`, and fallback/error details when unavailable.
- Real-wallet object scanner now has explicit `deepbook_object` classification and improved facts for DeepBook balance managers/orders, Walrus blobs, StrategyReceipt objects, package caps, coin objects, and DeFi candidates.
- Wallet object display groups categories and prioritizes DeepBook, Walrus, receipt, DeFi candidate, and cap objects before coin objects.
- Final validation pass confirmed judge/disconnected mode, DeepBook market evidence, OpenAI live explanation, prepare/archive, and real Walrus CLI archive work without browser console errors.
- Focused connected-wallet validation found no blocking app-side wallet UI bug; Slush failed in the automation browser session because no wallet provider/popup flow was available there.
- `npm run lint`, `npm run typecheck`, `npm test`, and `npm run build` all passed.

## Checklist

### Done

- Mainnet Sui/Walrus environment is configured and must not be reinitialized.
- DeepBook mainnet prepare-only path works.
- Walrus mainnet upload/read smoke test passed.
- Receipt contract is deployed on Sui mainnet.
- OpenAI live explanations are configured and verified through the Responses API.
- DeepBook market evidence is attached to each prepared audit package before `/api/audit`.
- Owned-object scanner/display has been strengthened for DeepBook/Walrus/receipt/DeFi/cap/coin categories while keeping connected-wallet mode real-wallet-first.
- Core demo and tests are complete.
- README and this runtime state file reflect the current connected-wallet behavior, OpenAI live state, and delegated DeepBook evidence/scanner pass.

### Optional Later

- Enable live DeepBook execution only for eligible spot SUI/USDC swaps.
- If OpenAI is configured, keep secrets only in `.env.local`; the default API mode is `responses`, with `chat` available as an explicit fallback.
- Add Walrus production gateway / auth if this grows beyond hackathon demo mode.
- Full protocol-specific position decoding is still not implemented; object classification remains heuristic from Move type/module/fields.
- Add more polish, more scenario templates, or more protocol integrations.
- Re-run connected-wallet manual validation in a normal user browser session where Slush provider/popup is available; latest automation-browser attempts reached the Slush modal but ended with `Opening Slush`, `Connection failed`, and `Retry Connection`.
- Add a small wallet-modal failure hint only if we want extra polish; it is non-blocking for the judge/disconnected demo.

### Latest Delegated Validation

- Delegated GPT reported `npm run typecheck` passed.
- Delegated GPT reported `npm run lint` passed.
- Delegated GPT reported `npm test` passed: 9 files, 39 tests.
- Delegated GPT reported `npm run build` passed.
- Delegated GPT reported browser smoke check on `http://localhost:3000` passed: app loads, judge mode visible, prepare/archive completed, and expanded Audit JSON contains `deepbookMarketEvidence` with `SUI_USDC`, `midPrice`, and `fetchedAt`.
- Delegated GPT did not manually connect a wallet in that pass; connected-wallet no-demo-mixing is covered by tests.

### Final Validation Pass

- Validation reused the existing dev server on `http://localhost:3000`.
- Commands reported passed: `npm run typecheck`, `npm run lint`, `npm test` (9 files, 39 tests), `npm run build`.
- Browser validation reported no app console errors.
- Overview, Risk, Strategy, Audit, and Prepare stages rendered.
- Scenario cards clicked successfully.
- Strategy showed live DeepBook market snapshot: `SUI_USDC`, mid price, pool status, vaults.
- OpenAI explanation mode showed `openai`, status `ready`.
- Prepare/archive succeeded.
- Expanded Audit JSON included `deepbookMarketEvidence`, `SUI_USDC`, `midPrice`, and `fetchedAt`.
- Walrus storage returned real `walrus-mainnet-cli`, not local fallback.
- Connected-wallet manual validation is still pending: Slush modal opened and Slush was selected, but the browser session ended with `Connection failed / Retry Connection`.
- Screenshots reported by delegated validation:
  - `/tmp/riskpilot-final-validation/overview-judge.png`
  - `/tmp/riskpilot-final-validation/strategy-deepbook-evidence-clean.png`
  - `/tmp/riskpilot-final-validation/audit-evidence-expanded-clean.png`
  - `/tmp/riskpilot-final-validation/connected-wallet-slush-failed.png`

### Focused Connected-Wallet Validation Attempt

- Commands reported passed: `npm run typecheck`, `npm run lint`, `npm test` (9 files, 39 tests), `npm run build`.
- Dev server was already running on `http://localhost:3000` and returned HTTP 200.
- Slush did not connect in the automation browser session.
- Exact visible states after selecting Slush and retrying: `Opening Slush`, `Connection failed`, `Retry Connection`.
- Likely cause reported: environment/browser-session wallet availability issue. The app opened the wallet modal, Slush was selectable, retry worked, no app console errors appeared, no popup/tab opened, and the in-app browser exposed no wallet provider globals.
- No code was changed.
- Blocking app bug found: none.
- Remaining validation gap: connected-wallet mode still needs a manual pass in a normal browser/session where Slush can complete connection.
- Screenshots reported:
  - `/tmp/riskpilot-connected-wallet-validation/wallet-modal-before-slush.png`
  - `/tmp/riskpilot-connected-wallet-validation/slush-connection-failed.png`
  - `/tmp/riskpilot-connected-wallet-validation/overview-before-connect.png`
  - `/tmp/riskpilot-connected-wallet-validation/slush-after-selection.png`

### Do Not Do Again

- Do not recreate the Sui wallet or Walrus config.
- Do not switch back to testnet/devnet.
- Do not make live execution the default.

## Current Mainnet Environment

- Sui active env: `mainnet`
- Sui active alias: `riskpilot-mainnet`
- Sui active address: `0x69bb839c43b5062487b00b5efa10c6d4914e2036a8c71cea8ce92002e12a8508`
- Sui CLI path/version: `/Users/puzhiqiu/.local/bin/sui`, `sui 1.72.2-85b460a63fd7`
- Sui RPC: `https://fullnode.mainnet.sui.io:443`
- Last known CLI wallet balances after earlier smoke tests: `0.38 SUI`, `2.98 WAL`; verify with read-only balance commands before spending because balances change.
- Walrus config: `~/.config/walrus/client_config.yaml`
- Walrus default context: `mainnet`
- Walrus CLI path/version: `/Users/puzhiqiu/.local/bin/walrus`, `walrus 1.48.1-9c5590a81e29`
- Walrus info works on mainnet
- Last verified blob from browser prepare/archive smoke test: `fYbZaxhANwoma1ZRxqm8VWL1bMByeg8CkiMKRxtmeCY`
- Last verified blob status: certified on mainnet and readable with `walrus read --skip-consistency-check`; normal consistency reads may warn while Walrus nodes lag on status quorum.
- Last receipt mint smoke tx: `Fui3ESVAtzsVwe55tPGE4VirWgouVw68o7kGH7X6woqP`
- Last receipt mint smoke object: `0x3c0b842ee005037d79f534c396da96eebb614ee37fd2aeb65ff8fbac64a6fd4b`

## Current Project Defaults

- `NEXT_PUBLIC_SUI_NETWORK=mainnet`
- `NEXT_PUBLIC_SUI_RPC_URL=https://fullnode.mainnet.sui.io:443`
- `NEXT_PUBLIC_MAINNET_EXECUTION_MODE=prepare`
- `NEXT_PUBLIC_ENABLE_DEEPBOOK_REAL=true`
- `WALRUS_MODE=walrus`
- `WALRUS_UPLOAD_METHOD=cli`
- `NEXT_PUBLIC_RECEIPT_PACKAGE_ID=0x3f889b1dba8796715690b5b78f6bc7ca0f248a45368649b8116f982bda847b19`
- `WALRUS_PUBLISHER_URL` and `WALRUS_AGGREGATOR_URL` are intentionally empty
- `OPENAI_API_MODE=responses`
- `OPENAI_MODEL=gpt-5.5`
- `OPENAI_REASONING_EFFORT=low`
- `OPENAI_API_KEY` and `OPENAI_BASE_URL` are configured in `.env.local`; never copy their values into docs, source, screenshots, commits, or chat logs.

## Why this exists

This demo already has a working mainnet setup. If anything is missing, verify before changing it.
