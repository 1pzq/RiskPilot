# RiskPilot Development Requirements

## 0. Purpose Of This Document

This document is a detailed product and engineering requirement for building the RiskPilot hackathon demo.

The intended reader is GPT-5.5 or another coding agent that will implement the full project. Follow this document as the source of truth unless the human team explicitly changes the scope.

RiskPilot is a Sui DeFi risk-management demo. It should help a user connect a Sui wallet, view portfolio risk, receive an AI-generated explanation, approve a bounded protective strategy, simulate or execute a DeepBook-style action, and store the decision package on Walrus.

## 1. Product Goal

Build a polished hackathon MVP for **RiskPilot: a verifiable AI risk manager for Sui DeFi**.

The demo must prove five things:

1. RiskPilot can read or model a user's Sui DeFi portfolio.
2. RiskPilot can identify meaningful risk signals.
3. RiskPilot can recommend a specific protective strategy.
4. RiskPilot can enforce user-defined policy limits before execution.
5. RiskPilot can create a verifiable audit package and upload it to Walrus or a local Walrus-compatible fallback.

## 2. Recommended Scope

### Must Have

- Next.js web app with TypeScript.
- Sui wallet connection.
- Portfolio dashboard.
- Real Sui balance reading when wallet is connected.
- Mock DeFi positions for lending and LP scenarios.
- Deterministic risk engine.
- Strategy recommendation engine.
- AI explanation endpoint with fallback mock explanation.
- Policy confirmation UI.
- DeepBook action builder with simulation-first fallback.
- Walrus audit package generation.
- Result page showing transaction digest or simulation ID and Walrus blob ID or local fallback ID.

### Should Have

- Clean UI with mobile and desktop support.
- Risk score before and after strategy.
- JSON audit preview.
- A small local demo mode that works even without testnet funds.
- Clear error states for wallet, RPC, AI, Walrus, and DeepBook failures.

### Nice To Have

- Real DeepBook SDK interaction on testnet.
- Real Walrus testnet upload.
- Session-key style authorization.
- Additional Sui DeFi integrations.
- Historical price charts.

## 3. Non-Goals For The Hackathon MVP

Do not attempt to build:

- A fully autonomous trading bot.
- A production-grade options pricing engine.
- Support for every Sui DeFi protocol.
- Custodial wallet or private key management.
- Real financial advice guarantees.
- Unbounded AI-generated transactions.

The MVP should be policy-constrained, explainable, and demo-friendly.

## 4. Suggested Tech Stack

### Frontend

- Next.js App Router
- TypeScript
- Tailwind CSS
- Sui dApp Kit
- React Query or TanStack Query
- Zustand or simple React state for demo state
- Recharts or lightweight custom charts
- lucide-react for icons

### Backend

- Next.js API routes or route handlers
- TypeScript
- Sui TypeScript SDK
- OpenAI API or model-provider-compatible SDK for explanations
- Walrus CLI / SDK integration when available
- Local filesystem fallback for audit blobs during development

### Chain / Protocol

- Sui testnet
- DeepBook / DeepBook Predict testnet if integration is stable
- Fallback transaction simulation when integration is incomplete

### Optional Move Contracts

For hackathon MVP, Move contracts are optional. If time allows, create a simple package:

- `PolicyVault`: stores a user's policy parameters.
- `StrategyReceipt`: stores the hash or ID of an executed strategy and Walrus blob ID.

If Move setup slows down the demo, prioritize frontend + TypeScript integration + Walrus audit package.

## 5. Environment Setup

### 5.1 Required Local Tools

Install:

- Node.js 20+
- pnpm or npm
- Git
- Sui CLI
- Walrus CLI if available

Recommended commands:

```bash
node --version
npm --version
sui --version
walrus --version
```

If `walrus` is not available, implement local fallback storage first and leave a clean adapter for real Walrus upload.

### 5.2 Project Initialization

If the repository is empty, initialize the app:

```bash
npx create-next-app@latest riskpilot --ts --tailwind --eslint --app --src-dir --import-alias "@/*"
cd riskpilot
```

If working directly in the repository root, initialize there instead:

```bash
npx create-next-app@latest . --ts --tailwind --eslint --app --src-dir --import-alias "@/*"
```

Install core dependencies:

```bash
npm install @mysten/sui @mysten/dapp-kit @tanstack/react-query zustand lucide-react recharts zod
```

Install AI dependency depending on chosen provider:

```bash
npm install openai
```

### 5.3 Environment Variables

Create `.env.local`:

```bash
NEXT_PUBLIC_SUI_NETWORK=testnet
NEXT_PUBLIC_SUI_RPC_URL=https://fullnode.testnet.sui.io:443
OPENAI_API_KEY=
WALRUS_MODE=local
WALRUS_PUBLISHER_URL=
WALRUS_AGGREGATOR_URL=
NEXT_PUBLIC_ENABLE_DEEPBOOK_REAL=false
```

Rules:

- The app must run when `OPENAI_API_KEY` is empty by using mock explanations.
- The app must run when Walrus is unavailable by using local fallback storage.
- The app must run when real DeepBook execution is disabled by using simulation mode.

### 5.4 Development Commands

Required scripts:

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "lint": "next lint",
    "typecheck": "tsc --noEmit",
    "test": "vitest run"
  }
}
```

Add Vitest if tests are implemented:

```bash
npm install -D vitest
```

## 6. Recommended File Structure

Use this structure:

```text
src/
  app/
    page.tsx
    layout.tsx
    globals.css
    api/
      explain/
        route.ts
      audit/
        route.ts
      execute/
        route.ts
  components/
    app-shell.tsx
    wallet-connect.tsx
    portfolio-overview.tsx
    risk-score-card.tsx
    risk-breakdown.tsx
    strategy-panel.tsx
    policy-review.tsx
    audit-log-panel.tsx
    result-panel.tsx
  lib/
    sui/
      client.ts
      portfolio.ts
      deepbook.ts
    risk/
      types.ts
      fixtures.ts
      risk-engine.ts
      scenarios.ts
    strategy/
      templates.ts
      strategy-builder.ts
      policy.ts
    ai/
      explain.ts
    walrus/
      types.ts
      audit-package.ts
      walrus-client.ts
      local-store.ts
    utils/
      format.ts
      ids.ts
  test/
    risk-engine.test.ts
    strategy-builder.test.ts
    policy.test.ts
```

## 7. Domain Models

### 7.1 Portfolio Types

Create these TypeScript types:

```ts
export type AssetBalance = {
  symbol: string;
  coinType: string;
  amount: number;
  usdPrice: number;
  usdValue: number;
};

export type LendingPosition = {
  protocol: string;
  collateralSymbol: string;
  collateralUsd: number;
  debtSymbol: string;
  debtUsd: number;
  healthFactor: number;
};

export type LiquidityPosition = {
  protocol: string;
  pair: string;
  usdValue: number;
  tokenAExposureUsd: number;
  tokenBExposureUsd: number;
  estimatedImpermanentLossRisk: "low" | "medium" | "high";
};

export type PortfolioSnapshot = {
  walletAddress: string;
  timestamp: string;
  assets: AssetBalance[];
  lendingPositions: LendingPosition[];
  liquidityPositions: LiquidityPosition[];
  totalUsdValue: number;
};
```

### 7.2 Risk Types

```ts
export type RiskLevel = "low" | "medium" | "high" | "critical";

export type RiskSignal = {
  id: string;
  title: string;
  level: RiskLevel;
  category: "concentration" | "price" | "liquidation" | "liquidity" | "stablecoin" | "lp";
  summary: string;
  evidence: string[];
  numericScore: number;
};

export type RiskReport = {
  portfolioId: string;
  overallScore: number;
  overallLevel: RiskLevel;
  signals: RiskSignal[];
  scenarioResults: {
    scenario: string;
    estimatedLossUsd: number;
    estimatedLossPct: number;
  }[];
};
```

### 7.3 Strategy Types

```ts
export type StrategyType =
  | "sui_downside_protection"
  | "rebalance_concentration"
  | "stablecoin_split"
  | "lending_deleverage"
  | "lp_risk_reduction";

export type StrategyRecommendation = {
  id: string;
  type: StrategyType;
  title: string;
  summary: string;
  targetRiskSignalIds: string[];
  estimatedCostUsd: number;
  expectedRiskReduction: number;
  deepbookAction: {
    mode: "simulate" | "testnet";
    market: string;
    side: "buy" | "sell";
    assetIn: string;
    assetOut: string;
    amountUsd: number;
    description: string;
  };
};
```

### 7.4 Policy Types

```ts
export type ExecutionPolicy = {
  maxBudgetUsd: number;
  maxSingleTradeUsd: number;
  allowedAssets: string[];
  allowedMarkets: string[];
  expiresAt: string;
  requireManualApproval: boolean;
};

export type PolicyCheckResult = {
  ok: boolean;
  errors: string[];
};
```

### 7.5 Audit Package Type

```ts
export type AuditPackage = {
  id: string;
  createdAt: string;
  walletAddress: string;
  portfolioSnapshot: PortfolioSnapshot;
  riskReportBefore: RiskReport;
  recommendation: StrategyRecommendation;
  policy: ExecutionPolicy;
  policyCheck: PolicyCheckResult;
  aiExplanation: string;
  execution: {
    mode: "simulation" | "testnet";
    status: "prepared" | "submitted" | "confirmed" | "failed";
    digest?: string;
    simulationId?: string;
    error?: string;
  };
  riskReportAfter?: RiskReport;
};
```

## 8. Phase 1: Build The Small Demo First

### 8.1 Phase 1 Goal

Build a local-first demo that works even without real DeepBook or Walrus integration.

The user should be able to:

1. Open the app.
2. See a polished RiskPilot dashboard.
3. Connect a Sui wallet or use demo mode.
4. View a portfolio with real SUI balance if connected and mock DeFi positions.
5. Generate a deterministic risk report.
6. Generate one recommended protection strategy.
7. Review policy limits.
8. Run a simulated DeepBook action.
9. Generate a local audit package.
10. See a result screen with simulation ID and audit package ID.

This is the first milestone because it proves the full product story end to end.

### 8.2 Phase 1 Feature 1: App Shell

Implement:

- Full-screen app layout.
- Header with project name, network badge, and wallet button.
- Main dashboard with left side portfolio/risk and right side strategy/audit workflow.
- Responsive layout for mobile.

Acceptance criteria:

- App runs with `npm run dev`.
- No landing page. The first screen is the actual RiskPilot app.
- UI looks like a serious financial tool, not a marketing page.

### 8.3 Phase 1 Feature 2: Demo Portfolio Fixtures

Create `src/lib/risk/fixtures.ts`.

Include one default portfolio:

- 65% SUI exposure.
- 20% stablecoin exposure.
- 10% SUI/USDC LP exposure.
- 5% other assets.
- One lending position with health factor around 1.45.

Acceptance criteria:

- Portfolio total USD value is computed.
- UI displays asset allocation.
- UI displays lending and LP cards.

### 8.4 Phase 1 Feature 3: Wallet Connection And Balance Merge

Implement Sui dApp Kit provider and wallet connect button.

When a wallet is connected:

- Fetch SUI balance from testnet RPC.
- Replace or merge the fixture SUI balance with the real balance.
- Keep mock lending and LP positions for demo richness.

Fallback:

- If no wallet is connected, use demo wallet address `0xDEMO`.
- If RPC fails, show a non-blocking warning and continue in demo mode.

Acceptance criteria:

- User can connect wallet.
- Real address appears in UI.
- App remains usable without wallet.

### 8.5 Phase 1 Feature 4: Deterministic Risk Engine

Create `risk-engine.ts`.

Rules:

- If one asset is more than 50% of portfolio, create high concentration signal.
- If SUI exposure is more than 50%, create high SUI downside signal.
- If stablecoins are more than 80% in one stablecoin, create medium stablecoin concentration signal.
- If lending health factor is below 1.3, create critical liquidation signal.
- If lending health factor is 1.3 to 1.6, create high liquidation signal.
- If LP impermanent loss risk is high, create medium or high LP signal depending on LP size.

Scenario calculation:

- Scenario `SUI -10%`: estimate loss based on SUI exposure.
- Scenario `SUI -20%`: estimate loss based on SUI exposure.
- Scenario `Stablecoin depeg -5%`: estimate loss based on stablecoin exposure.

Acceptance criteria:

- Risk report is deterministic.
- Overall score is 0 to 100.
- At least three signals appear in demo mode.
- Add unit tests for key rules.

### 8.6 Phase 1 Feature 5: Strategy Builder

Create `strategy-builder.ts`.

For the first demo, implement one main strategy:

`sui_downside_protection`

Trigger:

- SUI downside signal is high or critical.

Recommended action:

- Allocate 5% to 10% of portfolio value, capped at policy max budget.
- Generate a DeepBook-style simulated action:
  - market: `SUI/USDC`
  - side: `sell` or `buy protection`
  - description: "Simulated downside protection using DeepBook Predict-style binary protection."

Also implement fallback strategy:

`rebalance_concentration`

Trigger:

- concentration risk high, but no DeepBook Predict mode available.

Acceptance criteria:

- At least one recommendation always appears for the default fixture.
- Strategy shows cost, target risk, expected risk reduction, and action details.

### 8.7 Phase 1 Feature 6: AI Explanation Endpoint

Create `/api/explain`.

Input:

- Portfolio snapshot.
- Risk report.
- Recommendation.

Output:

- Human-readable explanation.

Implementation:

- If `OPENAI_API_KEY` exists, call the model.
- If not, return a deterministic mock explanation.

Prompt requirements:

- Do not promise profit.
- Explain risk in simple language.
- Mention that this is not financial advice.
- Mention policy limits.
- Keep response under 180 words.

Acceptance criteria:

- Endpoint returns valid JSON.
- UI displays explanation.
- App works without API key.

### 8.8 Phase 1 Feature 7: Policy Review

Create a policy form with defaults:

- `maxBudgetUsd`: recommended cost rounded up.
- `maxSingleTradeUsd`: same as max budget.
- `allowedAssets`: `["SUI", "USDC"]`
- `allowedMarkets`: `["SUI/USDC"]`
- `expiresAt`: 24 hours from now.
- `requireManualApproval`: true.

Implement policy check:

- Strategy estimated cost must be <= maxBudgetUsd.
- Strategy action amount must be <= maxSingleTradeUsd.
- Strategy assets must be allowed.
- Strategy market must be allowed.
- Policy must not be expired.

Acceptance criteria:

- User can edit policy values.
- UI blocks execution if policy check fails.
- Policy check errors are readable.

### 8.9 Phase 1 Feature 8: Simulated DeepBook Execution

Create `/api/execute`.

For Phase 1, do not require real DeepBook execution.

Input:

- Recommendation.
- Policy.
- Policy check result.

Behavior:

- If policy check fails, return error.
- If policy check passes, return:
  - `mode: "simulation"`
  - `status: "confirmed"`
  - `simulationId: "sim_" + random id`
  - pseudo digest or action hash

Acceptance criteria:

- Execution button produces a result.
- Result is deterministic enough for testing but unique per run.
- UI clearly labels the result as simulation.

### 8.10 Phase 1 Feature 9: Local Audit Package

Create `/api/audit`.

For Phase 1:

- Generate full `AuditPackage`.
- Save it in memory or local file only if file writes are acceptable.
- Return `auditId` and JSON payload.

Better local fallback:

- Store audit data in browser state or localStorage.
- Return an ID like `local_audit_...`.

Acceptance criteria:

- Audit package contains portfolio, risk report, recommendation, policy, explanation, execution result.
- UI displays audit ID.
- UI can show raw JSON in a collapsible panel.

### 8.11 Phase 1 Feature 10: Result Screen

After execution and audit creation, show:

- Strategy status.
- Simulation ID.
- Audit package ID.
- Before risk score.
- After estimated risk score.
- Button to view audit JSON.

Acceptance criteria:

- User can understand the whole lifecycle in under two minutes.
- Demo is complete even without testnet funds.

## 9. Phase 2: Add Real Integrations On Top Of Phase 1

### 9.1 Phase 2 Goal

Replace or supplement Phase 1 fallbacks with real Sui ecosystem integrations while keeping the demo stable.

Phase 2 should not break Phase 1. Every real integration must have a fallback.

### 9.2 Phase 2 Feature 1: Real Sui Portfolio Improvements

Improve `portfolio.ts`:

- Fetch all coin balances for connected wallet.
- Map known coin types to symbols.
- Add basic USD price mapping through static prices or a simple API.
- Display unknown coins as "Unknown Token".

Acceptance criteria:

- Wallet assets appear dynamically.
- Demo mock positions still appear.
- No crash when token metadata is missing.

### 9.3 Phase 2 Feature 2: DeepBook Adapter

Create `src/lib/sui/deepbook.ts`.

Define adapter interface:

```ts
export type DeepBookExecutionRequest = {
  market: string;
  side: "buy" | "sell";
  assetIn: string;
  assetOut: string;
  amountUsd: number;
};

export type DeepBookExecutionResult = {
  mode: "simulation" | "testnet";
  status: "prepared" | "submitted" | "confirmed" | "failed";
  digest?: string;
  simulationId?: string;
  error?: string;
};
```

Implement:

- `simulateDeepBookAction(request)`
- `prepareDeepBookTransaction(request, walletAddress)`
- `executeDeepBookTransaction(request, signer)` if feasible

Rules:

- If `NEXT_PUBLIC_ENABLE_DEEPBOOK_REAL=false`, use simulation.
- If real execution fails, return a structured error and allow simulation fallback.

Acceptance criteria:

- UI can switch between simulation and real testnet mode.
- Real mode failure does not break demo.
- Result object shape is the same for both modes.

### 9.4 Phase 2 Feature 3: DeepBook Predict Strategy Template

Add a strategy template:

`deepbook_predict_downside_binary`

Concept:

- The user wants protection if SUI falls below a selected threshold by a selected expiry.
- Strategy uses a binary/prediction-style market or simulated equivalent.

UI fields:

- Protection threshold: -10%, -15%, -20%.
- Expiry: 1 day, 7 days, 14 days.
- Budget: user selected, policy-capped.

Acceptance criteria:

- Strategy parameters are visible.
- Recommendation explains the condition clearly.
- Audit package includes threshold and expiry.

### 9.5 Phase 2 Feature 4: Real Walrus Adapter

Create `walrus-client.ts`.

Interface:

```ts
export type AuditStorageResult = {
  mode: "local" | "walrus";
  id: string;
  url?: string;
  error?: string;
};
```

Implement:

- `storeAuditPackageLocal(auditPackage)`
- `storeAuditPackageWalrus(auditPackage)`
- `storeAuditPackage(auditPackage)` that chooses based on `WALRUS_MODE`.

Rules:

- If `WALRUS_MODE=local`, use local fallback.
- If Walrus upload fails, return local fallback and warning.
- Do not lose audit package data.

Acceptance criteria:

- UI displays whether storage mode is `local` or `walrus`.
- If Walrus succeeds, show blob ID and URL.
- If Walrus fails, show fallback ID and warning.

### 9.6 Phase 2 Feature 5: Risk Report After Strategy

After execution, estimate post-strategy risk.

Simple method:

- Clone previous risk report.
- Reduce target signal scores by `expectedRiskReduction`.
- Recompute overall score.
- Mark it as estimated.

Acceptance criteria:

- UI shows before/after risk score.
- Audit package includes both reports.
- It is clearly labeled as estimated, not guaranteed.

### 9.7 Phase 2 Feature 6: Better Demo Scenarios

Add scenario selector:

- Conservative SUI holder.
- Leveraged lending user.
- LP with impermanent loss risk.
- DAO treasury with stablecoin concentration.

Each scenario should populate fixtures and trigger a different strategy.

Acceptance criteria:

- User can switch scenario without reconnecting wallet.
- Risk report updates immediately.
- Each scenario produces a relevant recommendation.

### 9.8 Phase 2 Feature 7: Optional Move Receipt

Only implement if there is enough time.

Create a Move package with:

- `StrategyReceipt` object.
- Fields:
  - owner
  - strategy_id
  - audit_blob_id
  - created_at
  - execution_digest

The TypeScript app should optionally call this contract after execution.

Acceptance criteria:

- Move package builds.
- Testnet publish instructions are documented.
- UI can show receipt object ID if available.

## 10. UI Requirements

### 10.1 Visual Direction

RiskPilot should feel like a professional DeFi risk terminal:

- Dense but readable.
- Calm, serious, and trustworthy.
- No marketing landing page.
- No oversized hero.
- No decorative gradient blobs.
- Use cards only for individual panels.
- Avoid one-color palette.
- Use clear status colors:
  - green for low risk
  - yellow for medium
  - orange for high
  - red for critical

### 10.2 Main Screen Layout

Required sections:

- Header:
  - RiskPilot logo text
  - network badge
  - wallet button
- Portfolio Overview:
  - total value
  - asset allocation
  - position cards
- Risk Breakdown:
  - overall risk score
  - risk signals
  - scenario loss estimates
- Strategy Panel:
  - recommended action
  - cost
  - target risk
  - expected risk reduction
- Policy Review:
  - editable limits
  - pass/fail checks
- Execution And Audit:
  - execute/simulate button
  - result
  - audit ID
  - JSON preview

### 10.3 Interaction Requirements

- All buttons must have loading states.
- Execution button disabled until policy check passes.
- Wallet connection is optional for demo mode.
- Errors should be shown inline.
- Long JSON should be collapsible.

## 11. API Routes

### 11.1 `POST /api/explain`

Request:

```json
{
  "portfolio": {},
  "riskReport": {},
  "recommendation": {}
}
```

Response:

```json
{
  "explanation": "string",
  "mode": "ai | mock"
}
```

### 11.2 `POST /api/execute`

Request:

```json
{
  "recommendation": {},
  "policy": {},
  "policyCheck": {}
}
```

Response:

```json
{
  "mode": "simulation",
  "status": "confirmed",
  "simulationId": "sim_123",
  "digest": "0x..."
}
```

### 11.3 `POST /api/audit`

Request:

```json
{
  "auditPackage": {}
}
```

Response:

```json
{
  "mode": "local",
  "id": "local_audit_123",
  "url": null
}
```

## 12. Testing Requirements

Add unit tests for:

- Risk concentration rule.
- SUI downside rule.
- Lending health factor rule.
- Strategy recommendation selection.
- Policy check pass case.
- Policy check failure for budget.
- Policy check failure for disallowed market.

Minimum command:

```bash
npm run typecheck
npm run lint
npm run test
npm run build
```

If lint is not available because of Next.js version differences, document the reason and still run typecheck/build.

## 13. Demo Script

The final demo should follow this sequence:

1. Open RiskPilot dashboard.
2. Connect Sui wallet or use demo mode.
3. Show portfolio composition with high SUI exposure.
4. Show risk score and three risk signals.
5. Select "Protect SUI downside".
6. Show AI explanation.
7. Show policy limits.
8. Lower the budget to intentionally trigger a policy failure.
9. Restore valid budget.
10. Execute simulation or testnet transaction.
11. Show result digest / simulation ID.
12. Show Walrus or local audit ID.
13. Open audit JSON and show the full decision trail.
14. Show before/after estimated risk score.

## 14. Acceptance Criteria For The Whole Project

The project is complete when:

- `npm run dev` starts the app.
- The first screen is the RiskPilot app, not a landing page.
- User can complete the demo without external funds.
- Wallet connection works when available.
- Risk engine produces deterministic signals.
- At least one strategy is recommended.
- Policy checks can both pass and fail.
- Execution simulation works.
- Audit package is generated.
- Walrus adapter or local fallback returns an ID.
- UI shows before/after risk.
- Build succeeds.

## 15. Implementation Priorities

If time is limited, implement in this order:

1. App shell and fixture portfolio.
2. Risk engine.
3. Strategy builder.
4. Policy review.
5. Simulated execution.
6. Audit package.
7. Wallet connection.
8. AI explanation.
9. Walrus real upload.
10. DeepBook real execution.
11. Optional Move receipt.

The demo must always remain end-to-end functional. Real integrations should enhance the demo, not make it fragile.

## 16. Important Safety And Messaging Rules

The app must not claim:

- Guaranteed profit.
- Guaranteed protection.
- Personalized financial advice.
- Production-ready automated trading.

The app may say:

- "Estimated risk reduction."
- "Simulation result."
- "Strategy recommendation."
- "Not financial advice."
- "Execution remains under user-approved policy limits."

## 17. Suggested README Summary

Use this short summary in the repository README:

RiskPilot is a verifiable AI risk manager for Sui DeFi. It scans a user's Sui portfolio, detects concentration, downside, liquidation, stablecoin, and LP risks, recommends a bounded protection strategy, simulates or executes a DeepBook-style action, and stores the full decision trail as a Walrus audit package.

## 18. Final Notes For The Coding Agent

Build the smallest complete version first. Do not get stuck on real protocol integration before the local-first demo works. The most important hackathon story is:

**Risk detected -> strategy recommended -> policy enforced -> action executed/simulated -> decision stored on Walrus.**

Every implementation decision should support that story.
