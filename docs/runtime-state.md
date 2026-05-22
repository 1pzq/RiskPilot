# RiskPilot Runtime State

Read this first. Do not repeat anything marked as already done.

Last handoff update: 2026-05-22 after the wallet-connect fix and first browser click-through pass.

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
- AI explain endpoint works with mock fallback.
- `npm run lint`, `npm run typecheck`, `npm test`, and `npm run build` all passed.

## Checklist

### Done

- Mainnet Sui/Walrus environment is configured and must not be reinitialized.
- DeepBook mainnet prepare-only path works.
- Walrus mainnet upload/read smoke test passed.
- Receipt contract is deployed on Sui mainnet.
- Core demo and tests are complete.
- README and this runtime state file now reflect the current connected-wallet behavior and first-pass test result.

### Optional Later

- Enable live DeepBook execution only for eligible spot SUI/USDC swaps.
- Add OpenAI live explanations if a real key is provided.
- Add Walrus production gateway / auth if this grows beyond hackathon demo mode.
- Add more polish, more scenario templates, or more protocol integrations.
- Run a second full manual browser pass before final submission recording: disconnect judge mode, Slush connect, real wallet portfolio, DeepBook prepare, Walrus archive, optional receipt mint, and console check.

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
- `OPENAI_API_KEY` may stay empty for mock explanations

## Why this exists

This demo already has a working mainnet setup. If anything is missing, verify before changing it.
