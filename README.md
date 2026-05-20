# RiskPilot

RiskPilot is a Sui Overflow 2026 hackathon demo for a verifiable AI risk manager on Sui mainnet.

The demo reads a connected Sui mainnet wallet when available, enriches it with modeled DeFi positions, produces deterministic risk signals, recommends a bounded DeepBook or DeepBook Predict protection action, enforces a user policy gate, prepares the mainnet action without submitting funds, and archives the full decision package through Walrus mainnet or a local fallback.

## Safety Defaults

- Sui network: mainnet only.
- DeepBook mode: `prepare_mainnet` by default.
- No live transaction submission is implemented in the app.
- Wallet connection is optional; judge scenarios work without funds.
- OpenAI and Walrus are optional. Missing configuration falls back gracefully.
- Local simulation is labeled as a local fallback and is not a chain path.

## Quick Start

Requirements:

- Node.js 20+
- npm
- Optional: Sui wallet browser extension
- Optional: Walrus publisher and aggregator URLs
- Optional: OpenAI API key

Install and run:

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open:

```text
http://localhost:3000
```

## Judge Demo Script

1. Open the dashboard and keep the wallet disconnected to show demo mode.
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
9. If Walrus URLs are not configured, explain that the audit package is stored locally and the warning is expected.
10. Connect a Sui mainnet wallet, if desired, to show real coin balance enrichment merged into the same risk workflow.

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

Optional AI explanation:

```bash
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4.1-mini
```

Optional Walrus mainnet upload:

```bash
WALRUS_MODE=walrus
WALRUS_PUBLISHER_URL=
WALRUS_AGGREGATOR_URL=
```

Optional future receipt package:

```bash
NEXT_PUBLIC_RECEIPT_PACKAGE_ID=
```

If `OPENAI_API_KEY` is empty, the app returns a deterministic mock explanation. If Walrus URLs are empty or upload fails, the app writes the audit package to `.riskpilot-data/audits`.

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
src/components          Dashboard, policy, strategy, audit, and result UI
src/lib/risk            Fixtures, scenarios, risk engine, and shared types
src/lib/strategy        Strategy templates and policy checks
src/lib/sui             Mainnet Sui portfolio and DeepBook adapters
src/lib/walrus          Audit packaging and Walrus/local storage adapters
src/test                Focused unit tests
move                    Optional StrategyReceipt Move package
```

## Optional Move Receipt

The `move/` package contains a non-blocking `StrategyReceipt` object for a future deployed receipt flow. It is not required for the web demo.

When Sui CLI is installed and configured for mainnet:

```bash
sui client switch --env mainnet
sui move build --path move
```

Publishing spends mainnet gas and should only be done deliberately:

```bash
sui client publish --path move --gas-budget 50000000
```

## Notes

RiskPilot is a demo and not financial advice. It does not guarantee profit or protection. The AI explanation is narrative only; risk labels, policy checks, and action bounds are deterministic.
