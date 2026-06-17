# RiskPilot Judge Walkthrough

Use this as the tight 3-minute demo script for judges. Keep the spoken demo flow on the six-step workflow rail: Prime context -> Score risk -> Run what-if -> Lock strategy -> Open agent room -> Prepare archive.

Submission framing: RiskPilot's primary track is **Agentic Web**. The agent system is the product surface: an Incident Room opens the case, bounded agents produce findings and handoffs, the Manager locks the final command, and the Evidence Timeline makes the reasoning inspectable. Sui mainnet, DeepBook, and Walrus are the strong infrastructure proof underneath, not a competing track story.

The Final Completeness Pass should be visible in the demo:

- **Proof before pitch**: open with the Walrus proof rail: blob id, blob object, register tx, certify tx, readback command, and blob-status command.
- **Six-step workflow rail**: use the action buttons as the visible path so judges do not read the app as one final archive button.
- **Real wallet context**: connect a Sui mainnet wallet before running risk, strategy, agent, and archive stages.
- **Red-team boundary checks**: click Run checks and show `/api/execute`, `/api/audit`, policy blocking, and AI posture lock all passing without wallet signature or gas.
- **Wallet Health Summary**: when connected, show the user's top concern, whether RiskPilot has an actionable priced route, and which unknown assets/objects stay evidence-only.
- **Archive Preflight**: before paying, show the expected wallet approvals and Walrus register/upload/certify progress.
- **Archive History**: after archive, reopen the local recent result and point to audit id, blob id, register digest, certify digest, and Walrus readback.
- **Audit Package Explorer**: after prepare/archive, expand the evidence bundle and point to policy, DeepBook evidence, Incident Room JSON, Agent Council JSON, checksum, storage provider, archive payer, and raw audit JSON.
- **What-if Strategy Diff**: in Risk/Audit, compare the base strategy against a preview stress scenario and say clearly that the diff is estimated and cannot replace the real prepare/archive payload.

## 30-Second Elevator Pitch

RiskPilot is an Agentic Web incident room for Sui DeFi risk. The latest wallet-paid Walrus proof is already visible in the product: blob `ucjtVWMzIrYk2vczZpPGMexeJwQsendfrrb7_eQEizk`, register tx `5PHtpzFqxz8jrXew23nW9QGmCekXNd714D7hCqpCJseS`, and certify tx `GG6KB537teUvjKMjP4xpqeD4Dao2usQx62kKmVtE69AR`. The app reads a connected Sui mainnet wallet, runs deterministic risk checks, lets bounded agents explain and hand off the case, and archives the decision package through connected-wallet Walrus storage. The key safety point is simple: AI writes the briefing, deterministic rules lock policy and execution. What-if strategy diffs are preview-only; they never replace the real archive or execution payload.

## 3-Minute Demo Script

### 0:00-0:20 - Proof

"Before the pitch, here is the proof rail. This latest completed wallet-paid Walrus archive has blob `ucjtVWMzIrYk2vczZpPGMexeJwQsendfrrb7_eQEizk`, blob object `0xdbf1058c9f842f3ae577735d9ce42a76769eee7d8bb5ba8a91d797c29e175cf2`, register tx `5PHtpzFqxz8jrXew23nW9QGmCekXNd714D7hCqpCJseS`, and certify tx `GG6KB537teUvjKMjP4xpqeD4Dao2usQx62kKmVtE69AR`. The product exposes the readback and blob-status commands directly."

Show:
- Walrus proof rail.
- Full blob id, blob object, register tx, certify tx.
- Readback command and blob-status command.

Key line:
"RiskPilot's verifiable evidence claim starts with IDs you can inspect, not a paragraph you have to trust."

### 0:20-0:45 - Overview

"This is RiskPilot, an Agentic Web incident room for Sui DeFi risk. Before connection, the product exposes the latest Walrus proof and red-team boundary checks. For the live walkthrough, we connect a Sui mainnet wallet so RiskPilot reads real balances and owned objects. The product is designed like an incident room: agents help explain the risk, compare options, and hand off evidence, but every execution boundary is deterministic and auditable."

Show:
- Current mode: proof/boundary inspection before connection; connected-wallet workflow after connection.
- The six workflow buttons: Prime context, Score risk, Run what-if, Lock strategy, Open agent room, Prepare archive.
- Wallet Health Summary, portfolio snapshot, and object scan summary.
- The spoken flow: context -> risk -> what-if -> strategy -> agents -> wallet-paid archive.

Key line:
"The Agentic Web layer coordinates the room; it cannot override policy checks, change action bounds, or submit a transaction."

### 0:45-1:10 - Risk

"Now we move to Risk. The score and signals come from deterministic rules: concentration, downside exposure, stablecoin mix, lending health, LP risk, unknown assets, and wallet-object evidence. If this is a connected wallet, RiskPilot uses real mainnet wallet rows only; it does not mix in demo DeFi positions."

Show:
- Risk score and severity.
- Top risk signals.
- Evidence rows that explain why the score changed.

Key line:
"This is not an opaque agent deciding risk. The risk report is rule-based, inspectable, and carried into the audit package."

### 1:10-1:40 - What-if

"Next is the What-if Strategy Diff. I can stress the same portfolio with SUI down 15%, thinner DeepBook liquidity, unknown asset inflow, tighter policy budget, or DeepBook unavailable. The simulator clones the portfolio, applies the scenario, reruns the deterministic risk engine, and shows how the recommended posture would differ from the base case."

Show:
- Pick `SUI -15%` or `DeepBook unavailable`.
- Point to score delta, value delta, and new risk signals.
- Point to the preview Incident Room/Council label and describe it as a strategy diff, not a real execution plan.

Key line:
"What-if is preview-only. It is estimated, it does not mutate the wallet, it does not enter the real Walrus archive, and it cannot execute. The real Prepare path requires a locked execution intent, so removing the preview marker still fails digest validation."

Safety line:
"This screen has two lanes: the yellow What-if lane is simulated preview; the real path starts only in Prepare from the connected wallet base path."

### 1:40-2:05 - Strategy

"RiskPilot then turns the risk report into a bounded strategy. For supported SUI/USDC exposure, it can prepare a DeepBook or DeepBook Predict-style protection action. If the wallet has no priced actionable risk, it returns wallet review instead of inventing a trade."

Show:
- Recommendation type and rationale.
- DeepBook market evidence if available.
- Guardrails, fallback, and prepare-only reason.

Key line:
"The strategy is constrained by deterministic eligibility: asset, market, route, budget, and action bounds must match the policy."

### 2:05-2:35 - Audit

"Audit is where the Agentic Web story becomes verifiable. The Incident Room assigns bounded work to Risk Analyst, Liquidity Scout, Policy Guard, Execution Planner, Audit Agent, and Manager. The Agent Council gives a second committee view. AI can improve briefing language and findings, but the final command, handoffs, policy status, and evidence timeline are locked by deterministic code."

Show:
- Incident Room briefing and task board.
- Agent Council synthesis.
- Evidence Timeline: Wallet Scan -> Risk Signals -> Strategy -> Policy Gate -> DeepBook Evidence -> Walrus Archive -> Receipt.
- What-if preview banner if a simulation is active.
- Agent mode and locked-field labels.

Key line:
"AI explains; deterministic rules decide whether the action is allowed. These are bounded incident roles with optional AI wording, not autonomous trading agents."

### 2:35-3:15 - Prepare

"Finally we leave execution mode on Prepare mainnet, the default safety posture. Before payment, the preflight shows the subject wallet, the signer, the archive payer, the locked execution intent, and the exact approval sequence. I can also click Red-team boundary checks: they call local safe endpoints and show `/api/execute`, `/api/audit`, policy blocking, and AI posture lock passing without wallet signature, gas, or Walrus payment. When I click prepare and wallet-paid archive, RiskPilot prepares the action package, checks policy, attaches DeepBook evidence, and asks the connected wallet to register and certify Walrus storage. The same boundary applies to live Spot and receipts: if a chain action costs money, the connected wallet signs and pays it."

Show:
- `Prepare mainnet (default)`.
- Policy gate status.
- Execution intent id and digest row.
- Red-team boundary checks: four PASS rows.
- Archive Preflight: 2 approvals for prepare archive, or 3 if live Spot is explicitly selected.
- Archive History after success: audit id, Walrus blob id, register digest, certify digest, and readback link.
- Audit Package Explorer: prepared digest, audit id, checksum, storage provider, archive payer/signer, DeepBook evidence, Incident Room JSON, Agent Council JSON, and raw Audit JSON.

Key line:
"The final artifact is not just a recommendation. It is an Audit Package Explorer for the Wallet Scan-to-Receipt evidence chain, and judges can inspect it without any private key or secret."

Fallback line:
"If a live DeepBook transaction is rejected or fails, RiskPilot stops before Walrus payment. The user must explicitly choose the prepare-only fallback before paying to archive it."

## Judge Q&A Points

**Is the AI making trades?**  
No. AI only writes explanation, briefing, task finding wording, deliberation wording, and summaries. Deterministic code controls `policyCheck`, DeepBook eligibility, action bounds, archive behavior, final commands, handoffs, and `prepare_mainnet`.

**Are these six independent model agents?**
No. They are six bounded incident roles inside a deterministic workflow. Optional AI can improve wording, but it cannot change posture, handoffs, final command, policy result, execution mode, wallet requirements, or archive behavior.

**Why is this Agentic Web instead of only DeFi infrastructure?**  
The primary product surface is the bounded agent workflow: Incident Room roles, task findings, handoffs, council synthesis, strategy diff, and an inspectable evidence chain. Sui mainnet, DeepBook, and Walrus make the agent decisions verifiable with real wallet state, market evidence, and storage.

**What happens if the AI provider is unavailable?**  
RiskPilot falls back to deterministic text. The Sui wallet read, risk engine, policy gate, prepare path, connected-wallet Walrus archive, and audit package continue to work.

**What makes What-if safe?**  
What-if uses a cloned portfolio and marks output as estimated preview data. It is a strategy diff only: it cannot replace the real portfolio, cannot pass into `/api/execute` or `/api/audit` as the real payload, cannot mint a receipt, and cannot submit live execution. The real Prepare path also requires a locked execution intent with matching portfolio, risk report, recommendation, and policy digests, so removing the preview marker still fails validation.

**Is Policy Gate enforced on-chain?**
Not yet. The current Policy Gate is app/server enforced: it prevents client UI drift, stale checks, and AI wording overreach before execution preparation. The audit package records the policy result, and future hardening can move reusable treasury mandates into Move policy objects or multi-signer rules.

**Is this mainnet or demo data?**  
The walkthrough path is connected-wallet mainnet data. Before wallet connection, RiskPilot exposes proof rail and boundary checks only; it does not present fixed demo data as the evaluation path. Connected-wallet mode reads live Sui mainnet balances and owned objects, removes synthetic lending/LP demo positions, and does not invent trades from unknown or unpriced coins.

**Where does DeepBook fit?**  
DeepBook provides the market evidence and bounded SUI/USDC action path. DeepBook Predict-style protection remains prepare-only. Live DeepBook spot execution is not the default and requires explicit eligible routing plus wallet approval. If live signing/execution fails or is rejected, RiskPilot stops before Walrus archive payment instead of silently charging for a fallback archive.

**Where does Walrus fit?**  
Walrus stores the audit package through the connected wallet. The browser wallet signs Walrus register and certify transactions and pays the required storage costs; no backend or local wallet is a default payer. The audit payload preserves portfolio, risk, strategy, policy, DeepBook evidence, Incident Room, Agent Council, archive result, and optional receipt context. Recent archives also appear in local browser history so the user can reopen the result and verify blob/digest evidence.

**How can judges red-team the boundary?**
Open Prepare and click Run checks. It performs safe local checks for `/api/execute` preview rejection, `/api/audit` preview rejection, policy-blocked execution, and AI posture lock. It requests no wallet signature, no gas, and no Walrus payment.

**What is the strongest safety claim?**  
RiskPilot separates narrative from authority: agents can brief the user, but deterministic rules lock the policy and execution boundary.

## Demo Safety Reminders

- Do not show `.env.local`.
- Do not paste or display private keys, seed phrases, OpenAI-compatible provider keys, proxy keys, or wallet secrets.
- Keep the default action mode on `Prepare mainnet`.
- Treat live DeepBook execution as an explicit opt-in path, not the hackathon default.
- If live DeepBook is rejected, say that archive payment has not started.
- When discussing What-if, always say "preview-only" before showing Audit or Prepare.
