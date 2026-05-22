# RiskPilot

RiskPilot is a Sui Overflow 2026 hackathon demo for a verifiable AI risk manager on Sui mainnet.

The demo has two clear modes. When no wallet is connected, judges can use curated risk stories to see the full workflow. When a Sui wallet is connected, RiskPilot switches to real-wallet mode: it reads live mainnet coin balances, scans owned mainnet objects, removes synthetic lending/LP demo positions, computes deterministic risk signals, recommends a bounded DeepBook or DeepBook Predict-style protection action only when the wallet data supports it, enforces a user policy gate, prepares the mainnet action, and archives the full decision package through Walrus mainnet or a local fallback.

## Safety Defaults

- Sui network: mainnet only.
- DeepBook mode: `prepare_mainnet` by default.
- Live DeepBook is not the default. It is gated to eligible spot SUI/USDC actions and still requires explicit wallet approval.
- Wallet connection is optional; judge scenarios work without funds.
- Connected-wallet mode uses real mainnet wallet rows only; it does not mix in demo assets or synthetic DeFi positions.
- OpenAI and Walrus are optional. Missing configuration falls back gracefully.
- Local simulation is labeled as a local fallback and is not a chain path.

## Quick Start

Requirements:

- Node.js 20+
- npm
- Optional: Slush or another Sui wallet browser extension
- Optional: Walrus CLI, or Walrus publisher and aggregator URLs
- Optional: OpenAI API key

Important:

- The local Sui / Walrus environment is already configured for mainnet use.
- Do not rerun wallet initialization or delete `~/.sui/sui_config/client.yaml` / `~/.config/walrus/client_config.yaml` unless you are explicitly resetting the machine.
- If either config file ever disappears, stop and restore it first instead of letting the CLI auto-generate a new wallet.
- Never paste a private key into source files, docs, screenshots, commits, or issue comments.
- The durable runtime state is documented in `docs/runtime-state.md`.

Install and run:

```bash
npm install
test -f .env.local || cp .env.example .env.local
npm run dev
```

Open:

```text
http://localhost:3000
```

## Judge Demo Script

1. Open the dashboard and keep the wallet disconnected to show judge mode.
2. Select each portfolio case:
   - Conservative SUI holder
   - Leveraged lending user
   - LP with IL risk
   - DAO treasury
3. Point out that the risk score, signals, scenarios, and recommendation update immediately.
4. For the default SUI case, show the DeepBook Predict downside cover parameters.
5. Review the policy gate: budget, single action cap, allowed assets, allowed market, expiry, manual approval.
6. Leave action mode on `Prepare mainnet (default)`.
7. Click `Prepare and archive action`.
8. Show the prepared digest, before/after estimated risk, venue, audit ID, checksum, and raw audit JSON.
9. If `WALRUS_UPLOAD_METHOD=cli` is configured and the Walrus CLI has mainnet funds, show the Walrus blob ID. If Walrus is unavailable, explain that local audit fallback is expected.
10. Connect a Sui mainnet wallet to switch into real-wallet mode. Confirm the scenario cards disappear, visible assets come from wallet balances, object counts come from the mainnet scan, and unpriced unknown tokens do not create fake DeepBook trades.
11. After a Walrus archive, optionally mint a StrategyReceipt object if the connected wallet is approved in Slush.

## Current Verification Checkpoint

As of 2026-05-22:

- Slush wallet connection is fixed and the first manual browser click-through passed.
- Connected-wallet mode reads live Sui mainnet balances and owned objects.
- Connected-wallet portfolio rows are real-wallet rows only; synthetic lending/LP demo rows are cleared after connection.
- DeepBook remains `prepare_mainnet` by default. Live DeepBook is still an explicit, gated path.
- Walrus CLI mainnet upload and read have been smoke-tested. Local fallback remains available.
- StrategyReceipt is published on Sui mainnet and receipt minting has passed a mainnet smoke test.
- OpenAI live explanations are configured through an OpenAI-compatible Responses API gateway; `/api/explain` smoke test returned `mode: openai`.
- `npm run lint`, `npm run typecheck`, `npm test`, and `npm run build` passed in the current implementation cycle.

## Environment Variables

Copy `.env.example` to `.env.local`. The app runs with the example values.

Core defaults:

```bash
NEXT_PUBLIC_SUI_NETWORK=mainnet
NEXT_PUBLIC_SUI_RPC_URL=https://fullnode.mainnet.sui.io:443
NEXT_PUBLIC_DEFAULT_MAX_BUDGET_USD=5
NEXT_PUBLIC_MAINNET_EXECUTION_MODE=prepare
NEXT_PUBLIC_ENABLE_DEEPBOOK_REAL=true
```

AI explanation:

```bash
OPENAI_API_KEY=
OPENAI_BASE_URL=
OPENAI_MODEL=gpt-5.5
OPENAI_API_MODE=responses
OPENAI_REASONING_EFFORT=low
```

Optional Walrus mainnet upload:

```bash
WALRUS_MODE=walrus
WALRUS_UPLOAD_METHOD=cli
WALRUS_PUBLISHER_URL=
WALRUS_AGGREGATOR_URL=
```

Optional on-chain receipt package:

```bash
NEXT_PUBLIC_RECEIPT_PACKAGE_ID=0x3f889b1dba8796715690b5b78f6bc7ca0f248a45368649b8116f982bda847b19
```

Use `OPENAI_BASE_URL` only when your key is from an OpenAI-compatible relay or gateway. `OPENAI_API_MODE=responses` is the default path; set it to `chat` only for a gateway that does not support the Responses API. The current local `.env.local` has live OpenAI-compatible explanation calls configured and verified, but the key/base URL must stay private. Use `WALRUS_UPLOAD_METHOD=cli` when running the hackathon demo from a machine with the Walrus CLI configured for mainnet. Use `publisher` only if you explicitly want to target a Walrus HTTP publisher endpoint. If `OPENAI_API_KEY` is empty, the app returns a deterministic mock explanation. If OpenAI is configured but unavailable, the UI falls back to the mock explanation instead of blocking the Sui/Walrus flow. If Walrus upload fails, the app writes the audit package to `.riskpilot-data/audits`. Keep `.env.local` private and never commit secrets or private keys.

## Scripts

```bash
npm run dev
npm run typecheck
npm run lint
npm test
npm run build
```

## Project Structure

```text
src/app                 Next.js routes and API endpoints
src/frontend/components Dashboard, policy, strategy, audit, and result UI
src/frontend/styles     Global frontend styling
src/lib/risk            Fixtures, scenarios, risk engine, and shared types
src/lib/strategy        Strategy templates and policy checks
src/lib/sui             Mainnet Sui portfolio and DeepBook adapters
src/lib/walrus          Audit packaging and Walrus/local storage adapters
src/test                Focused unit tests
move                    Optional StrategyReceipt Move package
```

## Optional Move Receipt

The `move/` package contains a non-blocking `StrategyReceipt` object. It is published on Sui mainnet for the hackathon demo. Receipt minting is optional, happens only after a Walrus archive, and does not change the DeepBook prepare-only default.

Mainnet package:

```text
0x3f889b1dba8796715690b5b78f6bc7ca0f248a45368649b8116f982bda847b19
```

Publish transaction:

```text
8wM83UcqYzic71d84KsXpJLxGpMbZzCvqL7R9CEBwZi
```

When Sui CLI is installed and configured for mainnet:

```bash
sui client switch --env mainnet
sui move build --path move
```

Publishing spends mainnet gas and should only be done deliberately:

```bash
sui client publish move --gas-budget 50000000
```

## Notes

RiskPilot is a demo and not financial advice. It does not guarantee profit or protection. The AI explanation is narrative only; risk labels, policy checks, and action bounds are deterministic.
