# RiskPilot Agentic Web Upgrade Plan

## Purpose

This document resets RiskPilot's upgrade plan around the Sui Overflow 2026 **The Agentic Web** judging lens.

The current project already works as a verifiable Sui DeFi risk incident room. It reads real wallet state, scores risk deterministically, coordinates bounded agents, prepares DeepBook actions, archives evidence to Walrus, and can mint StrategyReceipt objects.

The judging gap is perception and authority placement:

- Today, RiskPilot can look like a risk tool with AI support.
- For The Agentic Web, it must read as a bounded Sui agent that can observe, plan, verify authority, act, and remember.

This plan is ordered by **reward/risk ratio**, not by architectural purity. The first changes should make the existing system easier for judges to understand as an agentic Sui system. Deeper protocol work follows after the narrative frame is correct.

## North Star

RiskPilot should be positioned as:

> A bounded Sui agent that watches wallet risk, plans a mitigation, checks its on-chain mandate, prepares a PTB, and writes verifiable memory to Walrus and Sui receipts.

Chinese product line:

> 你的钱包有风险时，RiskPilot 已经在行动。但它能做什么，由链上 Policy 决定。

Core rule:

> AI explains; deterministic and on-chain rules decide.

The important framing shift is:

- Avoid: "The agent cannot do X."
- Prefer: "The agent acts only inside its authorized Sui policy boundary."

The same safety boundary should feel like credible delegated authority, not a weakened agent.

## Execution Priority

```text
Immediately  Step 1  Narrative reshape
Day 2        Step 2  On-chain Policy Object
Day 3        Step 3  Tool timeline UI
Day 4        Step 4  Judge Mode
Day 5        Step 5  Prepare-only PTB loop
Optional     Step 6  Agent Memory
Last         Step 7  Refactor, docs, video
```

## Step 1: Narrative Reshape

### Priority

First priority.

### Reward / Risk

- Workload: low
- Reward: extremely high
- Risk: low

### Goal

Change the first impression from:

```text
Overview -> Risk -> Strategy -> Audit -> Prepare
```

to:

```text
Observe -> Plan -> Verify Policy -> Act -> Remember
```

This is mostly frontend copy and navigation work. It should happen before deeper engineering because it makes every existing and future feature read through the correct judging frame.

### Product Reframe

| Current framing | Agentic framing |
| --- | --- |
| RiskPilot helps analyze risk. | RiskPilot observes wallet state and decides what needs attention. |
| AI gives a recommendation. | The agent proposes an action from evidence and handoffs. |
| Policy Gate validates a strategy. | The agent checks its Sui mandate before acting. |
| Prepare archive. | The agent prepares a PTB and preserves its decision memory. |
| Walrus audit package. | Verifiable agent memory. |

### Stage Definitions

#### Observe

Agent reads wallet balances, owned objects, DeFi hints, DeepBook objects, Walrus blobs, receipts, and unknown assets.

Copy direction:

> Agent is scanning the wallet, separating actionable risk from evidence-only exposure.

#### Plan

Agent Council and Incident Room produce a coordinated action plan.

Copy direction:

> Manager has coordinated Risk Analyst, Liquidity Scout, Policy Guard, Execution Planner, and Audit Agent. The final command is locked from evidence.

#### Verify Policy

The system checks app/server policy now and later checks an on-chain Policy Object.

Copy direction:

> The agent is checking whether its Sui mandate allows this action.

#### Act

The agent prepares a DeepBook action or PTB. Live execution remains explicit and wallet-signed.

Copy direction:

> The agent has prepared the Sui action. Wallet signature remains the final authorization.

#### Remember

Walrus archive and StrategyReceipt become the agent's verifiable memory.

Copy direction:

> The agent records what it observed, planned, checked, and prepared so the next incident can reference prior evidence.

### Hero Copy

Recommended English:

```text
A bounded Sui agent that watches wallet risk,
plans a mitigation, checks its on-chain mandate,
and acts only when policy allows.
```

Recommended Chinese:

```text
你的钱包有风险时，它已经在行动。
但它能做什么，由链上 Policy 决定。
```

### Acceptance Criteria

- Navigation uses `Observe`, `Plan`, `Verify Policy`, `Act`, `Remember`.
- Hero positions RiskPilot as a bounded Sui agent, not only a risk incident room.
- Existing safety boundaries are still visible but framed as authorized action.
- No backend or contract changes are required for this step.

### Scoring Impact

- Agentic Autonomy: high perception gain
- Innovation: high perception gain
- Beyond the Hackathon: medium gain

## Step 2: On-Chain Policy Object

### Priority

Second priority.

### Reward / Risk

- Workload: medium
- Reward: extremely high
- Risk: medium

### Goal

Move the agent authority boundary from only app/server logic into a Sui object.

This directly answers the judging question:

> Where is the agent's authority boundary?

After this step, the answer should be:

> In a Sui Policy Object that defines what the agent is allowed to prepare or execute.

### Proposed Move Object

Create an `AgentPolicy` or `StrategyMandate` object with fields such as:

- `id`
- `owner`
- `allowed_markets`
- `allowed_assets`
- `max_budget_usd`
- `max_single_trade_usd`
- `expires_at`
- `requires_manual_approval`
- `status`
- `created_at`
- `updated_at`

### Proposed Entry Functions

- `create_policy`
- `update_policy`
- `revoke_policy`
- `record_strategy_receipt`

### App Changes

- Add a Policy Object area in `Verify Policy`.
- Let the user mint or select a policy object.
- Display policy object id, status, owner, expiry, budget, and allowed market.
- Store `policyObjectId` in the audit package.
- Include policy object evidence in Agent Council and Incident Room inputs.

### Acceptance Criteria

- A user can mint a policy object from the current RiskPilot policy.
- The UI displays the policy object id and status.
- Audit packages include `policyObjectId`.
- The agent timeline shows `validate_policy_object`.
- Tests cover expired, revoked, and mismatched policy object cases.

### Scoring Impact

- Sui Integration: very high
- Agentic Autonomy: high
- Technical Execution: medium

## Step 3: Tool Timeline UI

### Priority

Third priority.

### Reward / Risk

- Workload: low
- Reward: high
- Risk: low

### Goal

Make existing operations visible as agent tool use.

RiskPilot already performs many tool-like steps. Judges need to see those steps as an agent operating loop.

### Proposed Timeline

```text
Tool 1: read_wallet_objects
Tool 2: fetch_deepbook_market
Tool 3: validate_policy_object
Tool 4: build_strategy
Tool 5: build_ptb_or_prepare_action
Tool 6: archive_walrus
Tool 7: mint_strategy_receipt
```

Each row should show:

- status
- input summary
- output summary
- evidence reference
- whether wallet signature is required

### Initial Implementation

This can be mostly UI-only at first:

- Map existing wallet scan state to `read_wallet_objects`.
- Map DeepBook market state to `fetch_deepbook_market`.
- Map current policy check to `validate_policy_object`, with `app/server policy` until the Sui object is added.
- Map execution intent and DeepBook action to `build_ptb_or_prepare_action`.
- Map wallet archive progress to `archive_walrus`.
- Map receipt state to `mint_strategy_receipt`.

### Acceptance Criteria

- `Plan`, `Act`, and `Remember` screens show a clear tool timeline.
- Each timeline step maps to real state already in the app.
- Failed or pending states are understandable without reading docs.

### Scoring Impact

- Agentic Autonomy: high perception gain
- Technical Execution: medium gain

## Step 4: Judge Mode

### Priority

Fourth priority.

### Reward / Risk

- Workload: low
- Reward: high
- Risk: low

### Goal

Let judges walk the product without reading the README first.

This should be a guided path, not fake data. No-wallet mode can still show proof rail and boundary checks, while wallet mode guides the real workflow.

### Guided Flow

```text
1. Observe wallet
2. Plan with agents
3. Verify policy
4. Prepare action
5. Archive memory
6. Mint receipt
```

Each step should state:

- what the agent just did
- what evidence was produced
- whether wallet signature is required
- what the judge should click next

### Acceptance Criteria

- A judge can understand the full loop in under 30 seconds.
- A judge can complete the intended path without reading docs.
- Paid actions are clearly marked before they happen.
- Preview data is never presented as executable truth.

### Scoring Impact

- Technical Execution: medium
- Beyond the Hackathon: medium
- Overall demo reliability: high

## Step 5: Prepare-Only PTB Loop

### Priority

Fifth priority.

### Reward / Risk

- Workload: medium to high
- Reward: high
- Risk: medium

### Goal

Show that the agent can construct a real Sui action path without forcing risky live execution during the hackathon.

The target is prepare-only first. Do not rush live execution if time is tight.

### Minimal Supported Scenario

```text
SUI concentration or downside risk
-> Agent recommends SUI/USDC mitigation
-> Policy allows SUI/USDC
-> Agent constructs DeepBook spot PTB
-> User sees the PTB/action package
-> User can choose whether to sign later
-> Walrus archive records the prepared action
```

### Why Prepare-Only Is Enough

Prepare-only still demonstrates:

- Sui transaction construction
- DeepBook integration
- agent planning
- policy enforcement
- wallet authority boundary
- auditability

It avoids the failure risk of live market execution during judging.

### Acceptance Criteria

- The app can build a real DeepBook spot transaction object for an eligible route.
- The UI displays the PTB/action package as the agent's prepared action.
- The action is tied to policy, execution intent, and audit package evidence.
- Live execution remains an explicit optional path, not the default.

### Scoring Impact

- Sui Integration: high
- Agentic Autonomy: high
- Technical Execution: high

## Step 6: Agent Memory

### Priority

Sixth priority, optional if time is tight.

### Reward / Risk

- Workload: medium
- Reward: medium
- Risk: low to medium

### Goal

Turn existing Walrus archive and StrategyReceipt evidence into visible agent memory.

### Memory Sources

- local archive history as convenience readback
- Walrus blob id and readback URL
- StrategyReceipt object id
- policy object id
- prior final command
- prior execution digest

### UI Changes

Add an Agent Memory panel under `Remember`.

It should show:

- latest incident
- policy object used
- final command
- archive blob id
- receipt object id
- whether the current agent run referenced prior memory

### Agent Input Change

Feed a compact memory summary into Agent Council and Incident Room:

```text
Previous incident:
- policy object: ...
- final command: ...
- execution result: ...
- Walrus blob: ...
- receipt object: ...
```

### Acceptance Criteria

- The agent can reference the previous archived incident.
- The memory source is visible and verifiable.
- Local history is never treated as execution authority.

### Scoring Impact

- Agentic Autonomy: medium
- Innovation: medium
- Beyond the Hackathon: medium

## Step 7: Refactor, Docs, And Video

### Priority

Last. Do this after the product loop is stable.

### Reward / Risk

- Workload: medium
- Reward: low to medium
- Risk: low

### Refactor Targets

- Split `riskpilot-app.tsx` into stage-level components only after major UI changes settle.
- Split `globals.css` into smaller groups if time allows.
- Keep wallet, Walrus, DeepBook, policy, and agent modules isolated.

### Verification Checklist

Run before final handoff:

```bash
npm run lint
npm run typecheck
npm test
npm run build
git diff --check
```

Also run a secret scan before sharing, recording, or committing.

### Documentation Updates

Do these after implementation:

- README
- judge walkthrough
- architecture diagram
- mainnet verification
- policy object technical note
- agent memory note, if memory ships

### Video Plan

#### 90-Second Demo

1. Show RiskPilot as bounded Sui agent.
2. Observe wallet.
3. Plan with Agent Council.
4. Verify policy object.
5. Prepare PTB/action package.
6. Archive to Walrus.
7. Show receipt or memory.

#### 3-Minute Technical Walkthrough

1. Sui object model: policy object and receipt object.
2. Agent loop: observe, plan, verify, act, remember.
3. Execution boundary: preview guard, digest intent, policy checks.
4. Walrus memory.
5. Why bounded autonomy is safer than unrestricted automation.

## Do Not Do First

Avoid spending early time on:

- broad refactors
- major CSS cleanup
- long documentation rewrites
- live execution beyond the safe eligible path
- overexplaining what the agent is not allowed to do

These may be useful later, but they do not change the first judging impression as much as the steps above.

## The Single Highest-Leverage Change

If only one day is available, complete Step 1.

If two days are available, complete Step 1 and Step 2.

If three days are available, complete Step 1, Step 2, and Step 3.

The most important transformation is:

> Same underlying safety model, different judging frame: RiskPilot is not a dashboard that refuses to trade. It is a bounded Sui agent that acts only inside its authorized mandate.
