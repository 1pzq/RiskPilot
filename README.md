# RiskPilot

RiskPilot is a Sui Overflow 2026 **Agentic Web** project: a bounded Sui agent for DeFi wallet risk response.

It observes a Sui wallet, plans a mitigation strategy, verifies the agent's authority through policy, prepares a DeepBook action, and records the signed evidence trail to Walrus and StrategyReceipt. The core idea is simple:

> **AI can plan and explain. Sui objects, policy checks, wallet signatures, and receipts define what the agent is allowed to do.**

RiskPilot is not a chatbot wrapped around a dashboard, and it is not an unrestricted trading bot. It is a verifiable agent workflow designed to show how AI agents can act on Sui while staying inside explicit authority boundaries.

---

## Project Summary

RiskPilot helps Sui DeFi users and evaluators answer four questions:

- What risk does this wallet currently carry?
- What action would an agent propose?
- Is that action allowed by the agent's policy boundary?
- Can the action trail be verified after the fact?

The app turns this into a five-stage loop:

```text
Observe -> Plan -> Verify Policy -> Act -> Remember
```

Each stage exposes both the agent's decision and the evidence behind it. The final product surface is not just a recommendation; it is a proof chain that connects wallet state, policy authority, prepared action, wallet signature, Walrus archive, and optional Sui receipt.

---

## What The Demo Shows

### Observe

RiskPilot reads Sui wallet context and classifies wallet exposure into actionable risk signals. The user can inspect wallet assets, owned-object evidence, portfolio concentration, and risk score.

### Plan

The agent system produces a mitigation strategy from deterministic risk signals and market context. A multi-agent council separates roles such as Risk Analyst, Liquidity Scout, Policy Guard, Execution Planner, and Audit Agent.

### Verify Policy

Before any action is prepared, RiskPilot checks the agent's policy boundary. The policy covers budget, market, assets, expiry, and manual approval requirements. The UI presents this as an authority boundary rather than a loose AI suggestion.

### Act

RiskPilot prepares a **DeepBook Spot PTB proof path** for eligible SUI/USDC or USDC/SUI actions. The wallet can sign the prepared PTB bytes, but RiskPilot does not submit the transaction by default.

The Act page highlights the proof of agent action:

```text
Policy Object
-> Execution Intent
-> Prepared PTB Digest
-> Wallet Signature
-> Walrus Blob
-> StrategyReceipt
```

This makes the action verifiable without turning the demo into a live trading bot.

### Remember

RiskPilot archives the signed prepared action and decision package to Walrus. The Remember page summarizes who signed, what was signed, where the evidence was archived, and how it can be reviewed later. Optional StrategyReceipt minting links the strategy, execution digest, and Walrus blob back to Sui.

---

## Why This Is Agentic

RiskPilot is agentic because the system does more than answer questions:

- It observes wallet state and market context.
- It plans a risk response.
- It checks whether the plan is authorized.
- It prepares a concrete on-chain action path.
- It preserves memory for later review.

The agent does not have unlimited authority. Its autonomy is bounded by policy, deterministic checks, wallet signatures, and Sui/Walrus proof objects. That bounded design is the product thesis: useful agents should be able to act, but their authority should be visible and verifiable.

---

## Sui Integration

RiskPilot is designed around Sui-native primitives rather than treating Sui as a generic chain.

| Sui / Ecosystem Primitive | Role in RiskPilot |
| --- | --- |
| Sui Object Model | Policy objects, receipts, wallet-owned objects, and evidence-bearing assets are treated as first-class proof surfaces. |
| Policy Object | Represents the visible authority boundary for the agent's allowed behavior. |
| Programmable Transaction Blocks | Prepared DeepBook Spot action path is represented as signed PTB evidence without default live submission. |
| DeepBook | Provides the market route and liquidity context for SUI/USDC or USDC/SUI spot action proofs. |
| Wallet Signature | The user explicitly signs prepared action bytes; RiskPilot records the signature but does not submit by default. |
| Walrus | Stores the audit package and signed prepared action as durable evidence. |
| StrategyReceipt | Optional Sui receipt linking strategy id, execution digest, signer, and Walrus blob. |

The result is a chain of verifiable artifacts instead of a plain AI-generated recommendation.

---

## Agent Architecture

RiskPilot uses a bounded multi-agent workflow:

- **Manager** coordinates the incident and final command.
- **Risk Analyst** identifies deterministic portfolio risk signals.
- **Liquidity Scout** checks DeepBook market evidence.
- **Policy Guard** validates budget, asset, market, expiry, and approval constraints.
- **Execution Planner** prepares the safest allowed action path.
- **Audit Agent** preserves the decision trail and evidence.

The AI layer improves readability and synthesis. Authority-sensitive decisions remain deterministic: policy validation, preview rejection, route eligibility, execution mode, and wallet signature requirements are not delegated to model output.

---

## Proof Of Agent Action

The core judge-facing evidence chain is:

```text
Wallet / portfolio state
-> Risk report
-> Agent strategy
-> Policy verification
-> Execution intent
-> Prepared DeepBook PTB
-> Wallet signature
-> Walrus archive
-> StrategyReceipt
```

This is the main difference between RiskPilot and a normal DeFi dashboard. The project does not only show what the agent recommends; it shows how the recommendation was bounded, signed, archived, and made reviewable.

---

## Safety Boundary

RiskPilot's safety posture is intentionally conservative:

- The default execution mode is prepare-only.
- A signed prepared PTB is not submitted by default.
- Wallet signatures are required for paid or authority-bearing actions.
- What-if previews are isolated from real execution paths.
- Policy validation is recomputed before preparation.
- Walrus archive is user-signed and wallet-paid.
- StrategyReceipt minting is separate and explicit.

This keeps the project suitable for a hackathon demo while still proving a meaningful agent action path on Sui.

---

## Current Strengths

- Strong Sui-native story through Policy Object, PTB, DeepBook, Walrus, and StrategyReceipt.
- Clear bounded-agent design instead of unrestricted automation.
- Judge-friendly flow with visible proof of action and rememberable evidence.
- Useful product direction for DeFi wallets, DAO treasuries, funds, and audit-conscious Web3 teams.

---

## Future Direction

RiskPilot can grow into an agentic risk desk for Sui wallets and institutional DeFi operators. Future work includes broader protocol adapters, richer treasury policies, multi-signer review, stronger Move-level mandate enforcement, expanded DeepBook route coverage, and portable Walrus compliance artifacts.

The long-term vision is not an AI trader. It is a verifiable Sui agent that helps users understand risk, prepare safe actions, and preserve a reviewable decision trail.
