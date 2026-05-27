# RiskPilot

RiskPilot is a Sui Overflow 2026 demo for a verifiable AI risk manager on Sui mainnet.

Primary track: **Agentic Web**. The product surface is a bounded multi-agent incident room for DeFi wallet risk: agents brief, compare, hand off, and explain, while deterministic policy and execution code keep authority locked. Sui mainnet, DeepBook, and Walrus are supporting proof rails: Sui supplies real wallet/object state, DeepBook supplies market evidence and bounded action routes, and Walrus preserves the audit package.

## What It Does

- Reads either a curated judge scenario or a connected Sui mainnet wallet.
- Computes deterministic wallet risk across balances, DeFi-like positions, object evidence, and stress scenarios.
- Shows What-if Strategy Diff previews without mutating the real wallet workflow.
- Runs an Agentic Incident Room and Agent Council with deterministic fallback and optional AI-backed wording.
- Recommends bounded DeepBook / DeepBook Predict-style protection or wallet review when no priced actionable route exists.
- Enforces a user policy gate before prepare or live spot execution paths.
- Archives the decision package through Walrus mainnet or explicit local fallback.
- Optionally mints a Sui StrategyReceipt after archive.

Core rule: **AI explains; deterministic rules decide.**

## Safety Defaults

- Sui network: mainnet only.
- Default execution mode: `prepare_mainnet`.
- Live DeepBook is explicit opt-in only, limited to eligible spot SUI/USDC or USDC/SUI routes, and still requires wallet approval.
- Connected-wallet mode uses real mainnet wallet rows only; it does not mix in demo assets or synthetic lending/LP positions.
- What-if output is estimated preview data. It cannot replace real prepare/archive, Walrus payloads, receipt minting, or live execution.
- AI text can improve explanations, briefings, findings, deliberation, and summaries. It cannot override `policyCheck`, action bounds, final commands, handoffs, DeepBook eligibility, archive behavior, or the `prepare_mainnet` default.
- Secrets stay private. Do not commit `.env.local`, provider keys, private keys, seed phrases, proxy secrets, or wallet secrets.

## Quick Start

Requirements:

- Node.js 20+
- npm
- Optional: Slush or another Sui wallet browser extension
- Optional: Walrus CLI or Walrus HTTP endpoints
- Optional: OpenAI-compatible / DeepSeek API key in private `.env.local`

Run:

```bash
npm install
test -f .env.local || cp .env.example .env.local
npm run dev
```

Open:

```text
http://localhost:3000
```

Useful links:

- Judge walkthrough: [`docs/judge-walkthrough.md`](docs/judge-walkthrough.md)
- Project introduction / pitch: [`docs/project-introduction.md`](docs/project-introduction.md)
- Maintainer runtime state: [`docs/runtime-state.md`](docs/runtime-state.md)
- Optional receipt package: [`move/README.md`](move/README.md)

## Demo Flow

1. Open Overview in disconnected judge mode.
2. Use One-click Judge Demo Mode to prime the high-signal scenario.
3. Open Risk and switch What-if presets.
4. Open Strategy and compare base vs stressed posture.
5. Open Audit to inspect Incident Room, Agent Council, Evidence Timeline, and preview boundaries.
6. Open Prepare, keep `Prepare mainnet` selected, and archive the decision package.
7. Inspect Audit Package Explorer and optional StrategyReceipt context.
8. Connect a wallet only when you want to demonstrate real-wallet mode.

Connected-wallet mode must show live mainnet balances/object scan, hide scenario cards, clear synthetic demo lending/LP positions, and refuse to invent trades from unknown or unpriced coins.

## Environment

Copy `.env.example` to `.env.local`. Real provider keys belong only in `.env.local`.

Core defaults:

```bash
NEXT_PUBLIC_SUI_NETWORK=mainnet
NEXT_PUBLIC_SUI_RPC_URL=https://fullnode.mainnet.sui.io:443
NEXT_PUBLIC_DEFAULT_MAX_BUDGET_USD=5
NEXT_PUBLIC_MAINNET_EXECUTION_MODE=prepare
NEXT_PUBLIC_ENABLE_DEEPBOOK_REAL=true
```

Optional AI narrative layer:

```bash
OPENAI_API_KEY=
OPENAI_BASE_URL=
OPENAI_MODEL=gpt-5.5
OPENAI_API_MODE=responses
OPENAI_REASONING_EFFORT=low
```

Optional Walrus archive:

```bash
WALRUS_MODE=walrus
WALRUS_UPLOAD_METHOD=cli
WALRUS_PUBLISHER_URL=
WALRUS_AGGREGATOR_URL=
```

Optional StrategyReceipt:

```bash
NEXT_PUBLIC_RECEIPT_PACKAGE_ID=0x3f889b1dba8796715690b5b78f6bc7ca0f248a45368649b8116f982bda847b19
```

## Scripts

```bash
npm run dev
npm run lint
npm run typecheck
npm test
npm run build
```

## Project Structure

```text
src/app                 Next.js pages and API routes
src/frontend/components Dashboard, wallet, risk, strategy, audit, prepare, and receipt UI
src/frontend/styles     Global visual system and responsive layout rules
src/lib/risk            Risk engine, fixtures, What-if scenarios, and shared risk types
src/lib/strategy        Strategy builder, policy gate, and monitor rule generation
src/lib/agents          Incident Room, Agent Council, and AI narrative merge logic
src/lib/sui             Mainnet Sui wallet/object, DeepBook, and receipt adapters
src/lib/walrus          Audit packaging plus Walrus/local storage adapters
src/test                Focused safety and regression tests
move                    Optional StrategyReceipt Move package
```

## Current Verification

As of the latest cleanup pass:

- `npm run lint`, `npm run typecheck`, `npm test`, and `npm run build` are the required release checks.
- Browser smoke should cover Overview, Risk, Strategy, Audit, and Prepare on both `localhost:3000` and `127.0.0.1:3000`.
- Connected-wallet manual verification has previously passed in a normal wallet-capable browser; automation browsers may not expose Slush/provider popups.
- Do not reset Sui or Walrus configs. See [`docs/runtime-state.md`](docs/runtime-state.md) before touching local chain/storage setup.
