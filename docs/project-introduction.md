# RiskPilot: Agentic Web Submission

## Latest Verifiable Mainnet Evidence

RiskPilot's latest completed wallet-paid Walrus archive verification:

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

Verification commands:

```bash
walrus read ucjtVWMzIrYk2vczZpPGMexeJwQsendfrrb7_eQEizk --out /tmp/riskpilot-walrus-read.json
walrus blob-status --blob-id ucjtVWMzIrYk2vczZpPGMexeJwQsendfrrb7_eQEizk
```

Local red-team checks are also exposed in the product UI and through `/api/boundary-check`. The latest automated pass on `2026-06-06` returned all PASS for `/api/execute` preview rejection, `/api/audit` preview rejection, policy-blocked execution, and AI posture lock. No wallet signature, gas, or Walrus payment is requested by these checks.

## 1. One-Sentence Pitch

RiskPilot is a verifiable Agentic Web incident room for Sui DeFi risk: bounded agents triage a real Sui mainnet wallet, compare strategy outcomes, enforce deterministic policy gates, and archive the complete decision trail to Walrus so judges can inspect not only the recommendation, but the authority boundary behind it.

RiskPilot is built around one rule:

> **AI explains; deterministic rules decide.**

That rule is the product. The agent layer briefs, compares, hands off, and explains. The code decides whether a policy passes, whether a route is eligible, whether a preview can be submitted, whether a wallet must sign, and whether an audit package can be archived.

## 2. The Core Problem

Sui DeFi risk is not just a portfolio display problem. A real wallet can contain coin balances, DeFi-like objects, DeepBook state, Walrus blobs, receipts, package capabilities, unknown tokens, and protocol-specific position objects. The user needs to know which signals are priced, which ones are only evidence, and which actions are actually allowed.

Most AI-plus-DeFi products fail at this boundary. A chat agent can summarize risk, but it usually cannot prove that it did not silently change the execution path. A dashboard can show balances, but it usually does not preserve the reasoning chain from wallet state to recommendation to policy result to storage proof. A trading assistant can suggest action, but without strict authority separation it becomes difficult to know whether the agent is advising, preparing, or executing.

For an Agentic Web project, the central challenge is therefore not "can an AI write a useful risk paragraph?" The challenge is whether an agentic workflow can be made inspectable and bounded:

- What did each agent do?
- Which evidence did it read?
- Which handoff did it produce?
- Which command was locked?
- Which parts were narrative and which parts were enforceable code?
- Can a judge verify the result without trusting the model provider?

RiskPilot addresses this by turning wallet risk into a multi-agent incident workflow with deterministic execution control and a verifiable evidence package.

## 3. RiskPilot's Agentic Design

RiskPilot is not a chat window attached to a DeFi dashboard. The agent system is the main product surface.

The app opens a structured incident room around the connected Sui mainnet wallet. The Manager coordinates the case. The Risk Analyst identifies deterministic risk signals. The Liquidity Scout checks DeepBook market evidence. The Policy Guard enforces budget, market, asset, expiry, and manual approval constraints. The Execution Planner translates an allowed recommendation into the safest execution posture. The Audit Agent preserves the final evidence chain.

The key design choice is that agent authority is narrow. Agents can produce findings, handoffs, summaries, briefings, and council deliberation. They cannot mutate policy, bypass the server-side policy check, turn a What-if preview into a real payload, force a live DeepBook transaction, or pay for Walrus archive storage.

This boundary is enforced in code, not by prompt language:

- `validateExecutionPolicy` recomputes policy validity from the actual recommendation and user policy.
- `/api/execute` rejects payloads containing `previewOnly` or `source: what_if_preview`.
- `/api/execute` also requires a locked execution intent with portfolio, risk report, recommendation, and policy digests; reconstructed payloads fail digest validation even if a preview marker is removed.
- `/api/audit` rejects What-if payloads and disables server-side Walrus payment entirely.
- Live DeepBook eligibility is derived from selected mode, route type, wallet connection, market readiness, and policy result.
- The default execution mode remains `prepare_mainnet`.
- Wallet-paid Walrus archive is only loaded when the user reaches Prepare and clicks the explicit archive action.

AI improves readability. Deterministic rules own authority.

The current Policy Gate is app/server enforced. It protects against client UI drift, stale policy checks, and AI wording overreach by recomputing policy validity before execution preparation, but it is not yet a Move-level treasury spending mandate.

## 4. Technical Architecture: Sui Ecosystem Coordination

RiskPilot uses Sui ecosystem components as proof rails for the agentic workflow, not as disconnected integrations. Each component has a specific authority role.

| Component | Role in RiskPilot | What Judges Can Verify |
| --- | --- | --- |
| Sui mainnet | Reads live wallet balances and owned objects; detects coins, DeepBook objects, Walrus blobs, receipts, DeFi candidates, package caps, and unknown assets. | Connected-wallet mode uses real mainnet wallet rows and does not mix in synthetic demo lending/LP positions. |
| DeepBook | Provides market evidence and bounded action routes for SUI/USDC or USDC/SUI paths; DeepBook Predict-style routes remain prepare-only. | Audit packages include pool key, pool address, base/quote coins, mid price, route status, vault balances, and whitelist status when available. |
| Walrus | Stores the audit package through connected-wallet signed and paid register/upload/certify flow. | Archive results expose blob id, blob object id, register digest, certify digest, checksum, and readback URL. |
| Move StrategyReceipt | Optional post-archive receipt tying strategy id, Walrus blob id, and execution digest to a Sui object. | Receipt mint is separate from execution and requires an explicit wallet-signed action. |
| Incident Room | Multi-agent task board with Manager, Risk Analyst, Liquidity Scout, Policy Guard, Execution Planner, and Audit Agent. | Findings, evidence refs, handoffs, consensus, and final command are visible in the UI and audit package. |
| Agent Council | Committee-style second opinion across risk, strategy, policy, audit, and manager synthesis. | Council posture and agent outputs are preserved as structured evidence. |
| Policy Gate | Converts user intent into hard constraints: budget, single trade cap, allowed assets, allowed markets, expiry, and manual approval. | Policy result is recomputed server-side before execution preparation and stored in the audit package. Current enforcement is app/server-side, not yet a Move-level spending mandate. |

The evidence flow is intentionally linear:

```text
Connected Sui Mainnet Wallet
  -> Portfolio Snapshot
  -> Deterministic Risk Report
  -> What-if Preview Lane
  -> Strategy Recommendation
  -> Policy Gate
  -> DeepBook Market Evidence
  -> Incident Room and Agent Council
  -> Prepare or Eligible Live Spot
  -> Wallet-Paid Walrus Archive
  -> Optional Sui StrategyReceipt
```

The What-if lane is part of the analysis experience, but it is not part of the real execution source of truth. That separation is central to the project.

## 5. Six-Step Demo Flow

The judge opens RiskPilot and first sees proof before pitch: the Walrus proof rail exposes the latest verified blob, blob object, register tx, certify tx, readback command, and blob-status command. The top rail then shows the intended path: Prime context, Score risk, Run what-if, Lock strategy, Open agent room, and Prepare archive.

The first step primes context by connecting a Sui mainnet wallet. RiskPilot reads real coin balances, scans owned objects, and shows a wallet health summary that distinguishes actionable priced risk from unsupported or unknown exposure. Before wallet connection, judges can inspect the Walrus proof rail and run deterministic boundary checks, but the risk, strategy, agent, and archive workflow is presented as a connected-wallet path.

The second step opens the risk view. The judge sees a deterministic risk score, severity, signal breakdown, and evidence rows. This is where RiskPilot demonstrates that the agent is not inventing risk. Concentration, SUI downside exposure, stablecoin concentration, lending health, LP risk, and object evidence are computed by rules and carried forward as structured data.

The third step runs What-if Strategy Diff. A judge can select a scenario such as `SUI -15%`, DeepBook unavailable, or policy budget cut. RiskPilot clones the portfolio, applies the stress, recomputes risk, and compares the base strategy against the stressed strategy. The UI labels this as preview-only. The important demo moment is that the agent room can discuss the simulated case, but the real Prepare path requires a locked base execution intent, so the preview cannot become the real prepare/archive payload.

The fourth step locks strategy. RiskPilot turns the risk report into a bounded recommendation: DeepBook Predict-style downside cover, eligible spot preparation, or wallet review when no priced actionable route exists. The Policy Gate is visible beside the recommendation. Judges can edit the policy and see the route move from ready to blocked when budget, assets, markets, or expiry do not match.

The fifth step opens the agent room. This is the core Agentic Web surface. The Incident Room shows assigned agent tasks, findings, evidence references, handoffs, consensus, and the Manager's final command. The Agent Council gives a second committee view. The key point is visible in the product: agents coordinate and explain, but the final command is locked to deterministic posture such as prepare-ready, audit-only, live-ready, or policy-blocked.

The sixth step enters Prepare. The default mode is Prepare mainnet. Before any paid action, the Archive Preflight shows the subject wallet, signer, archive payer, selected mode, locked execution intent, and Walrus register/upload/certify timeline. If live DeepBook is not explicitly selected and eligible, no live transaction is submitted. If Walrus archive is performed, the connected wallet signs and pays; after success, the judge can inspect Audit Package Explorer, Archive History, blob id, digests, checksum, readback link, and optional StrategyReceipt context.

This gives judges two verification layers: no-wallet inspection for proof rail and deterministic boundary checks, and a connected-wallet workflow for real Sui mainnet state, strategy preparation, and paid Walrus evidence.

## 6. Core Technical Highlights

### What-if Strategy Diff: Preview, Not Fake Execution

RiskPilot's What-if system is designed as an isolated preview lane. The engine clones the current portfolio, applies a stress scenario, recomputes the deterministic risk report, and builds a preview strategy diff. It marks the output with `previewOnly: true`; scenarios can also carry market or policy overrides such as DeepBook unavailable or budget caps cut by 50%.

That marker is not cosmetic. The preview guard scans nested payloads for `previewOnly` or `source: what_if_preview`. `/api/execute` rejects those payloads for execution, and `/api/audit` rejects them for archive replacement. RiskPilot also locks the base portfolio, risk report, recommendation, and policy into an execution intent; if a client removes the preview marker and reconstructs a payload, the digest mismatch blocks execution. The UI can show simulated Incident Room and Council output, but Prepare/archive continues to use the connected-wallet base path.

This matters for Agentic Web because agents often blur simulation and action. RiskPilot makes the difference explicit and enforceable.

### Bounded Multi-Agent Collaboration

RiskPilot's agents are structured around fixed operational roles, not six autonomous trading processes. The Risk Analyst does not approve execution. The Policy Guard does not invent market evidence. The Execution Planner does not bypass wallet approval. The Audit Agent does not become a payer. The Manager synthesizes, but the final command is derived from deterministic posture and policy state.

The output is also structured: tasks, priorities, findings, evidence refs, handoffs, consensus items, severity, posture, and final command. Optional AI may improve briefing and finding wording only; locked posture, handoffs, final command, policy result, execution mode, and wallet requirements remain deterministic. If optional AI wording is unavailable, deterministic fallback still produces the same workflow. The agent system therefore remains functional even without a model provider.

The result is a real agentic workflow: agents coordinate a case, expose their handoffs, and preserve the reasoning trail, while code prevents role overreach.

### Verifiable Evidence Chain

RiskPilot does not stop at a recommendation. It packages the decision.

The audit package includes portfolio snapshot, wallet scan, risk report, strategy recommendation, policy, policy check, locked execution intent, monitor rules, DeepBook evidence, AI explanation, Incident Room, Agent Council, execution result, and storage metadata. Walrus archive returns a blob id, blob object id, register digest, certify digest, checksum, and readback URL. Archive History lets the user reopen recent local results, and optional StrategyReceipt can record the strategy-to-blob relationship on Sui mainnet.

The chain is:

```text
Wallet Scan -> Risk Signals -> Strategy -> Policy Gate
-> DeepBook Evidence -> Incident Room -> Agent Council
-> Walrus Blob ID -> Optional StrategyReceipt
```

That is the difference between "the AI said so" and "the system produced an inspectable decision record."

## 7. Safety Boundary Checklist

✅ **Can an agent trigger an on-chain transaction by itself?**  
No. Agents produce structured narrative and decision support. Paid chain actions require explicit UI action and wallet signature.

✅ **Is What-if isolated from real execution?**  
Yes. What-if output is marked preview-only, kept in a separate lane, and rejected by execution and audit endpoints if submitted as a real payload.

✅ **What if someone removes the preview marker?**
`/api/execute` requires a locked execution intent. The portfolio, risk report, recommendation, and policy digests must match the base path, so reconstructed preview payloads are rejected.

✅ **Does Walrus archive require user wallet signing and payment?**  
Yes. Server-side Walrus archive is disabled. Prepare requires a connected Sui mainnet wallet, and the browser wallet signs and pays Walrus register/certify.

✅ **Can AI override the Policy Gate or action bounds?**  
No. AI can improve wording, but policy validation, route eligibility, action bounds, final command posture, and execution mode are deterministic.

✅ **Is Policy Gate an on-chain spending mandate?**
No. The current gate is app/server enforced and stored in the audit package. It prevents AI/client drift today; Move-level mandates are future hardening.

✅ **Does live DeepBook require explicit opt-in and wallet confirmation?**  
Yes. Live Spot is not the default. It is limited to eligible routes, requires policy approval, requires explicit selection, and still requires wallet signing.

✅ **What happens if live DeepBook fails or is rejected?**  
RiskPilot stops before Walrus archive payment. The user must explicitly choose Prepare mainnet again to archive a prepare-only fallback record.

✅ **Can judges experience the full demo without connecting a wallet?**  
Yes, for inspection. The Walrus proof rail and deterministic boundary checks are visible without funds or secrets. The full risk, strategy, agent, and archive workflow uses a connected Sui mainnet wallet.

✅ **Are unknown or unpriced coins converted into fake trades?**  
No. Unknown/unpriced assets remain evidence-only and do not produce invented DeepBook actions.

## 8. Current Implementation Status

| Implemented and Verified | Demo Mode or Optional |
| --- | --- |
| Sui mainnet wallet balance reading. | No-wallet proof rail and boundary-check inspection. |
| Sui owned-object scan and classification. | Optional AI-backed narrative layer with deterministic fallback. |
| Deterministic risk engine and risk signals. | DeepBook Predict-style protection is prepare-only in the demo. |
| What-if simulation with preview guards. | Live DeepBook Spot is available only for explicitly eligible spot routes. |
| Strategy builder with wallet-review fallback. | StrategyReceipt mint is optional after archive. |
| Policy Gate with server-side revalidation. | Local Archive History is a convenience readback surface, not an execution source. |
| Locked execution intent digests for Prepare and `/api/execute`. | Move-level policy mandates are future hardening. |
| Incident Room and Agent Council outputs. |  |
| DeepBook mainnet SUI/USDC market evidence. |  |
| Wallet-paid Walrus archive flow. |  |
| Audit Package Explorer with raw JSON, checksum, policy, agent, and market evidence. |  |
| Tests for policy, risk, What-if, preview guards, execution intents, execution routes, archive behavior, agents, Walrus helpers, and DeepBook paths. |  |
| Mainnet verification notes for wallet read, DeepBook evidence, Walrus archive/readback, browser smoke, and preview guard checks. |  |

This status is intentionally honest: RiskPilot does not claim autonomous trading. Its completed core is safer and more relevant to the Agentic Web track: a bounded agent workflow with real Sui evidence and verifiable audit output.

## 9. Future Expansion

RiskPilot can grow beyond a hackathon demo into a pre-execution risk review and evidence packaging desk for Sui wallets, DAO treasury operators, and audit-conscious DeFi teams.

The first expansion path is broader protocol intelligence. The current object scanner already classifies protocol hints and DeFi candidates. More protocol-specific adapters could turn those hints into richer health metrics for lending, LP, staking, vault, and order-management positions while preserving the same evidence-first model.

The second path is production-grade policy automation. RiskPilot's Policy Gate can evolve into reusable wallet-level risk mandates: approved markets, spending envelopes, treasury roles, emergency rules, cooling-off periods, and multi-signer review. The agent room would remain advisory unless those deterministic mandates allow a prepared action.

The third path is institutional auditability. The Walrus audit package can become a portable compliance artifact: a team can prove which wallet state was read, which signals were active, which agents reviewed the case, which policy was applied, which action was prepared, and which wallet paid for storage. Optional Sui receipts make the chain/off-chain link stronger without pretending that every recommendation is an executed trade.

The fourth path is live market operations with stronger route coverage. DeepBook integration can be extended to more eligible markets and richer liquidity checks, but the safety posture should remain the same: live execution is opt-in, policy-gated, wallet-signed, and immediately archived.

The long-term product direction is not an AI trader. It is an agentic risk desk for Web3 wallets: explainable enough for users, bounded enough for security, and verifiable enough for technical evaluators.
