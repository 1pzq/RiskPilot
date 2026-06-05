# RiskPilot

RiskPilot is a Sui Overflow 2026 **Agentic Web** submission: a verifiable AI risk incident room for Sui DeFi wallets.

Core rule:

> **AI explains; deterministic rules decide.**

RiskPilot is not an autonomous trader and not a chatbot glued to a DeFi dashboard. It is a bounded multi-agent workflow where agents brief, compare, hand off, and explain while deterministic policy, execution, preview guards, Sui wallet signatures, DeepBook evidence, and Walrus archive proofs keep authority locked.

- English submission: [English Version](#english-version)
- 中文参赛介绍：[中文版本](#中文版本)
- Run locally: [Quick Start](#quick-start)

---

## English Version

### 1. One-Sentence Pitch

RiskPilot is a verifiable Agentic Web incident room for Sui DeFi risk: bounded agents triage a real Sui mainnet wallet, compare strategy outcomes, enforce deterministic policy gates, and archive the complete decision trail to Walrus so judges can inspect not only the recommendation, but the authority boundary behind it.

The agent layer briefs, compares, hands off, and explains. The code decides whether a policy passes, whether a route is eligible, whether a preview can be submitted, whether a wallet must sign, and whether an audit package can be archived.

### 2. The Core Problem

Sui DeFi risk is not just a portfolio display problem. A real wallet can contain coin balances, DeFi-like objects, DeepBook state, Walrus blobs, receipts, package capabilities, unknown tokens, and protocol-specific position objects. The user needs to know which signals are priced, which ones are only evidence, and which actions are actually allowed.

Most AI-plus-DeFi products fail at this boundary. A chat agent can summarize risk, but it usually cannot prove that it did not silently change the execution path. A dashboard can show balances, but it usually does not preserve the reasoning chain from wallet state to recommendation to policy result to storage proof. A trading assistant can suggest action, but without strict authority separation it becomes difficult to know whether the agent is advising, preparing, or executing.

For an Agentic Web project, the central challenge is whether an agentic workflow can be made inspectable and bounded:

- What did each agent do?
- Which evidence did it read?
- Which handoff did it produce?
- Which command was locked?
- Which parts were narrative and which parts were enforceable code?
- Can a judge verify the result without trusting the model provider?

RiskPilot addresses this by turning wallet risk into a multi-agent incident workflow with deterministic execution control and a verifiable evidence package.

### 3. RiskPilot's Agentic Design

RiskPilot is not a chat window attached to a DeFi dashboard. The agent system is the main product surface.

The app opens a structured incident room around the current wallet or judge scenario. The Manager coordinates the case. The Risk Analyst identifies deterministic risk signals. The Liquidity Scout checks DeepBook market evidence. The Policy Guard enforces budget, market, asset, expiry, and manual approval constraints. The Execution Planner translates an allowed recommendation into the safest execution posture. The Audit Agent preserves the final evidence chain.

The key design choice is that agent authority is narrow. Agents can produce findings, handoffs, summaries, briefings, and council deliberation. They cannot mutate policy, bypass the server-side policy check, turn a What-if preview into a real payload, force a live DeepBook transaction, or pay for Walrus archive storage.

This boundary is enforced in code, not by prompt language:

- `validateExecutionPolicy` recomputes policy validity from the actual recommendation and user policy.
- `/api/execute` rejects payloads containing `previewOnly` or `source: what_if_preview`.
- `/api/audit` rejects What-if payloads and disables server-side Walrus payment entirely.
- Live DeepBook eligibility is derived from selected mode, route type, wallet connection, market readiness, and policy result.
- The default execution mode remains `prepare_mainnet`.
- Wallet-paid Walrus archive is only loaded when the user reaches Prepare and clicks the explicit archive action.

AI improves readability. Deterministic rules own authority.

### 4. Technical Architecture: Sui Ecosystem Coordination

RiskPilot uses Sui ecosystem components as proof rails for the agentic workflow, not as disconnected integrations. Each component has a specific authority role.

| Component | Role in RiskPilot | What Judges Can Verify |
| --- | --- | --- |
| Sui mainnet | Reads live wallet balances and owned objects; detects coins, DeepBook objects, Walrus blobs, receipts, DeFi candidates, package caps, and unknown assets. | Connected-wallet mode uses real mainnet wallet rows and does not mix in synthetic demo lending/LP positions. |
| DeepBook | Provides market evidence and bounded action routes for SUI/USDC or USDC/SUI paths; DeepBook Predict-style routes remain prepare-only. | Audit packages include pool key, pool address, base/quote coins, mid price, route status, vault balances, and whitelist status when available. |
| Walrus | Stores the audit package through connected-wallet signed and paid register/upload/certify flow. | Archive results expose blob id, blob object id, register digest, certify digest, checksum, and readback URL. |
| Move StrategyReceipt | Optional post-archive receipt tying strategy id, Walrus blob id, and execution digest to a Sui object. | Receipt mint is separate from execution and requires an explicit wallet-signed action. |
| Incident Room | Multi-agent task board with Manager, Risk Analyst, Liquidity Scout, Policy Guard, Execution Planner, and Audit Agent. | Findings, evidence refs, handoffs, consensus, and final command are visible in the UI and audit package. |
| Agent Council | Committee-style second opinion across risk, strategy, policy, audit, and manager synthesis. | Council posture and agent outputs are preserved as structured evidence. |
| Policy Gate | Converts user intent into hard constraints: budget, single trade cap, allowed assets, allowed markets, expiry, and manual approval. | Policy result is recomputed server-side before execution preparation and stored in the audit package. |

Evidence flow:

```text
Wallet or Judge Scenario
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

The What-if lane is part of the analysis experience, but it is not part of the real execution source of truth.

### 5. Six-Step Demo Flow

The judge opens RiskPilot and first sees that the app is organized as a workflow, not a single "ask AI" box. The top rail shows the intended path: Prime context, Score risk, Run what-if, Lock strategy, Open agent room, and Prepare archive.

First, the evaluator primes context. In judge mode, they can start with a curated scenario and run the complete flow without a wallet, private key, or funds. If they connect a Sui wallet, RiskPilot switches to live mainnet wallet mode: scenario cards disappear, real coin balances load, owned objects are scanned, and the wallet health summary distinguishes actionable priced risk from unsupported or unknown exposure.

Second, the judge opens the risk view. They see a deterministic risk score, severity, signal breakdown, and evidence rows. Concentration, SUI downside exposure, stablecoin concentration, lending health, LP risk, and object evidence are computed by rules and carried forward as structured data.

Third, the judge runs What-if Strategy Diff. They can select a scenario such as `SUI -15%`, DeepBook unavailable, or policy budget cut. RiskPilot clones the portfolio, applies the stress, recomputes risk, and compares the base strategy against the stressed strategy. The UI labels this as preview-only, and the preview cannot become the real prepare/archive payload.

Fourth, the judge locks strategy. RiskPilot turns the risk report into a bounded recommendation: DeepBook Predict-style downside cover, eligible spot preparation, or wallet review when no priced actionable route exists. The Policy Gate is visible beside the recommendation, and policy edits can move the route from ready to blocked.

Fifth, the judge opens the agent room. The Incident Room shows assigned agent tasks, findings, evidence references, handoffs, consensus, and the Manager's final command. The Agent Council gives a second committee view. Agents coordinate and explain, but the final command is locked to deterministic posture such as prepare-ready, audit-only, live-ready, or policy-blocked.

Sixth, the judge enters Prepare. The default mode is Prepare mainnet. Before any paid action, the Archive Preflight shows the subject wallet, signer, archive payer, selected mode, and Walrus register/upload/certify timeline. If Walrus archive is performed, the connected wallet signs and pays. After success, the judge can inspect Audit Package Explorer, Archive History, blob id, digests, checksum, readback link, and optional StrategyReceipt context.

This gives judges two independent verification paths: a no-wallet path for the agentic workflow and a connected-wallet path for real Sui mainnet state and paid Walrus evidence.

### 6. Core Technical Highlights

#### What-if Strategy Diff: Preview, Not Fake Execution

RiskPilot's What-if system is an isolated preview lane. The engine clones the current portfolio, applies a stress scenario, recomputes the deterministic risk report, and builds a preview strategy diff. It marks the output with `previewOnly: true`; scenarios can also carry market or policy overrides such as DeepBook unavailable or budget caps cut by 50%.

That marker is not cosmetic. The preview guard scans nested payloads for `previewOnly` or `source: what_if_preview`. `/api/execute` rejects those payloads for execution, and `/api/audit` rejects them for archive replacement. The UI can show simulated Incident Room and Council output, but Prepare/archive continues to use the real wallet or selected judge scenario.

#### Bounded Multi-Agent Collaboration

RiskPilot's agents are structured around fixed operational roles. The Risk Analyst does not approve execution. The Policy Guard does not invent market evidence. The Execution Planner does not bypass wallet approval. The Audit Agent does not become a payer. The Manager synthesizes, but the final command is derived from deterministic posture and policy state.

The output is structured: tasks, priorities, findings, evidence refs, handoffs, consensus items, severity, posture, and final command. If optional AI wording is unavailable, deterministic fallback still produces the same workflow.

#### Verifiable Evidence Chain

RiskPilot does not stop at a recommendation. It packages the decision.

The audit package includes portfolio snapshot, wallet scan, risk report, strategy recommendation, policy, policy check, monitor rules, DeepBook evidence, AI explanation, Incident Room, Agent Council, execution result, and storage metadata. Walrus archive returns a blob id, blob object id, register digest, certify digest, checksum, and readback URL. Archive History lets the user reopen recent local results, and optional StrategyReceipt can record the strategy-to-blob relationship on Sui mainnet.

```text
Wallet Scan -> Risk Signals -> Strategy -> Policy Gate
-> DeepBook Evidence -> Incident Room -> Agent Council
-> Walrus Blob ID -> Optional StrategyReceipt
```

### 7. Safety Boundary Checklist

✅ **Can an agent trigger an on-chain transaction by itself?** No. Paid chain actions require explicit UI action and wallet signature.

✅ **Is What-if isolated from real execution?** Yes. Preview output is marked, separated, and rejected by execution/archive endpoints if submitted as real payload.

✅ **Does Walrus archive require user wallet signing and payment?** Yes. Server-side Walrus archive is disabled.

✅ **Can AI override the Policy Gate or action bounds?** No. AI can improve wording, but policy validation, route eligibility, action bounds, final command posture, and execution mode are deterministic.

✅ **Does live DeepBook require explicit opt-in and wallet confirmation?** Yes. Live Spot is not the default and requires eligible routing, policy approval, explicit selection, and wallet signing.

✅ **Can judges experience the full demo without connecting a wallet?** Yes. One-click Judge Demo Mode runs the workflow without funds or secrets.

### 8. Current Implementation Status

| Implemented and Verified | Demo Mode or Optional |
| --- | --- |
| Sui mainnet wallet balance reading. | One-click judge scenarios for no-wallet evaluation. |
| Sui owned-object scan and classification. | Optional AI-backed narrative layer with deterministic fallback. |
| Deterministic risk engine and risk signals. | DeepBook Predict-style protection is prepare-only in the demo. |
| What-if simulation with preview guards. | Live DeepBook Spot is available only for explicitly eligible spot routes. |
| Strategy builder with wallet-review fallback. | StrategyReceipt mint is optional after archive. |
| Policy Gate with server-side revalidation. | Local Archive History is a convenience readback surface, not an execution source. |
| Incident Room and Agent Council outputs. |  |
| DeepBook mainnet SUI/USDC market evidence. |  |
| Wallet-paid Walrus archive flow. |  |
| Audit Package Explorer with raw JSON, checksum, policy, agent, and market evidence. |  |
| Regression tests for risk, policy, What-if, routes, archive behavior, agents, Walrus helpers, and DeepBook paths. |  |

### 9. Future Expansion

RiskPilot can grow into a risk operations layer for Sui wallets, DeFi power users, funds, and DAO treasuries. Future work includes richer protocol adapters, reusable wallet-level policy mandates, multi-signer review, portable Walrus compliance artifacts, broader DeepBook route coverage, and stronger institutional audit workflows.

The long-term product direction is not an AI trader. It is an agentic risk desk for Web3 wallets: explainable enough for users, bounded enough for security, and verifiable enough for technical evaluators.

---

## 中文版本

### 1. 一句话 Pitch

RiskPilot 是一个面向 Sui DeFi 钱包风险的可验证 Agentic Web 事件室：受约束的多 Agent 读取真实 Sui 主网钱包，比较策略结果，执行确定性的 Policy Gate，并把完整决策链归档到 Walrus，让评委不仅能看到建议，还能检查建议背后的权限边界。

RiskPilot 的核心原则是：

> **AI explains; deterministic rules decide.**

也就是说，AI 负责解释、简报、比较、交接和总结；代码负责决定 policy 是否通过、DeepBook 路线是否合规、What-if preview 能不能提交、钱包是否必须签名、审计包是否能归档。

### 2. 核心问题

Sui DeFi 风险不是简单的资产展示问题。真实钱包里可能同时存在 coin balance、DeFi-like object、DeepBook state、Walrus blob、receipt、package capability、未知 token 和协议特定 position object。用户真正需要知道的是：哪些信号可以定价，哪些只是证据，哪些行动真的被允许。

很多 “AI + DeFi” 产品卡在边界问题上。聊天 Agent 可以总结风险，但通常无法证明自己没有悄悄改变执行路径。Dashboard 可以展示余额，但通常不会保存从钱包状态、风险建议、policy 结果到存储证明的完整推理链。交易助手可以建议行动，但如果没有严格权限分离，用户很难判断 Agent 到底是在建议、准备，还是执行。

在 Agentic Web 赛道，关键问题不是 “AI 能不能写一段风险总结”，而是：

- 每个 Agent 到底做了什么？
- 它读取了哪些证据？
- 它把什么交接给下一个角色？
- 最终命令是否被锁定？
- 哪些内容只是叙述，哪些内容是可执行的代码约束？
- 评委能不能在不信任模型供应商的情况下验证结果？

RiskPilot 的答案是：把钱包风险处理变成一个可审计的多 Agent incident workflow，并用确定性执行控制和可验证证据包锁住边界。

### 3. RiskPilot 的 Agentic 设计

RiskPilot 不是把聊天窗口贴在 DeFi 仪表盘旁边。Agent 系统本身就是产品主界面。

应用围绕当前钱包或评审场景打开一个结构化事件室。Manager 协调整个 case；Risk Analyst 识别确定性风险信号；Liquidity Scout 检查 DeepBook 市场证据；Policy Guard 执行预算、市场、资产、有效期和人工确认约束；Execution Planner 把合规建议翻译成最安全的执行姿态；Audit Agent 保存最终证据链。

关键设计是：Agent 权限很窄。Agent 可以生成 findings、handoffs、summary、briefing 和 council deliberation，但不能修改 policy，不能绕过服务端 policy check，不能把 What-if preview 变成真实 payload，不能强制 live DeepBook transaction，也不能替用户支付 Walrus archive。

这些边界不是靠 prompt 约束，而是靠代码强制：

- `validateExecutionPolicy` 会根据真实 recommendation 和用户 policy 重新计算有效性。
- `/api/execute` 会拒绝包含 `previewOnly` 或 `source: what_if_preview` 的 payload。
- `/api/audit` 会拒绝 What-if payload，并且完全禁用 server-side Walrus payment。
- Live DeepBook eligibility 由选择模式、route type、钱包连接、市场状态和 policy 结果共同决定。
- 默认执行模式保持 `prepare_mainnet`。
- Wallet-paid Walrus archive 只有在用户进入 Prepare 并点击显式 archive action 时才会加载。

AI 提升可读性；确定性规则掌握权限。

### 4. 技术架构：Sui 生态如何协同

RiskPilot 使用 Sui 生态组件作为 agentic workflow 的证明轨道，而不是孤立集成。每个组件都有明确的权限角色。

| 组件 | 在 RiskPilot 中的角色 | 评委可以验证什么 |
| --- | --- | --- |
| Sui mainnet | 读取真实钱包余额和 owned objects；识别 coins、DeepBook objects、Walrus blobs、receipts、DeFi candidates、package caps 和未知资产。 | 连接钱包模式使用真实主网钱包数据，不混入 demo lending/LP 仓位。 |
| DeepBook | 提供 SUI/USDC 或 USDC/SUI 市场证据和受约束行动路线；DeepBook Predict-style 路线保持 prepare-only。 | Audit package 中包含 pool key、pool address、base/quote coins、mid price、route status、vault balances 和 whitelist status。 |
| Walrus | 通过连接钱包签名和付款完成 audit package 的 register/upload/certify。 | Archive result 暴露 blob id、blob object id、register digest、certify digest、checksum 和 readback URL。 |
| Move StrategyReceipt | 可选 post-archive receipt，把 strategy id、Walrus blob id 和 execution digest 绑定到 Sui object。 | Receipt mint 与执行分离，必须由用户显式点击并用钱包签名。 |
| Incident Room | Manager、Risk Analyst、Liquidity Scout、Policy Guard、Execution Planner、Audit Agent 的多 Agent 任务板。 | Findings、evidence refs、handoffs、consensus 和 final command 在 UI 与 audit package 中可见。 |
| Agent Council | 从风险、策略、policy、审计和 Manager synthesis 角度给出委员会式第二视角。 | Council posture 和 Agent 输出作为结构化证据保存。 |
| Policy Gate | 把用户意图转换成硬约束：预算、单笔上限、允许资产、允许市场、有效期和人工确认。 | 执行准备前服务端重新计算 policy 结果，并写入 audit package。 |

证据流如下：

```text
Wallet or Judge Scenario
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

What-if 是分析体验的一部分，但不是现实执行路径的数据源。

### 5. 六步 Demo 流程

评委打开 RiskPilot，首先看到的不是一个 “Ask AI” 输入框，而是一条工作流 rail：Prime context、Score risk、Run what-if、Lock strategy、Open agent room、Prepare archive。

第一步，评委建立上下文。在 judge mode 下，评委可以用 curated scenario 完整跑通流程，不需要钱包、私钥或资金。如果连接 Sui 钱包，RiskPilot 会切换到真实主网钱包模式：scenario cards 隐藏，真实 coin balances 加载，owned objects 被扫描，Wallet Health Summary 会区分可行动的定价风险和未知/不支持的 evidence-only 暴露。

第二步，评委进入风险视图。这里展示确定性风险分数、严重程度、信号拆解和证据行。资产集中度、SUI downside、稳定币集中度、借贷健康度、LP 风险和 object evidence 都由规则计算，并作为结构化数据向后传递。

第三步，评委运行 What-if Strategy Diff。可以选择 `SUI -15%`、DeepBook unavailable、policy budget cut 等场景。RiskPilot 会克隆 portfolio，施加压力情景，重新计算风险，并比较 base strategy 与 stressed strategy。UI 明确标记 preview-only，且该 preview 不能成为真实 prepare/archive payload。

第四步，评委锁定策略。RiskPilot 把风险报告转换成受约束建议：DeepBook Predict-style downside cover、合规 spot preparation，或者在没有可定价路线时返回 wallet review。Policy Gate 显示在建议旁边，评委可以修改 policy，并看到路线从 ready 变成 blocked。

第五步，评委打开 Agent Room。Incident Room 展示每个 Agent 的任务、发现、证据引用、交接、共识和 Manager final command。Agent Council 提供委员会式第二视角。这里能清楚看到：Agent 负责协作和解释，但 final command 被确定性 posture 锁定，例如 prepare-ready、audit-only、live-ready 或 policy-blocked。

第六步，评委进入 Prepare。默认模式是 Prepare mainnet。任何付费动作前，Archive Preflight 会展示 subject wallet、signer、archive payer、selected mode 和 Walrus register/upload/certify timeline。如果执行 Walrus archive，连接钱包签名并付款。成功后，评委可以检查 Audit Package Explorer、Archive History、blob id、digests、checksum、readback link 和可选 StrategyReceipt context。

这给评委两条独立验证路径：无钱包路径验证 agentic workflow；连接钱包路径验证真实 Sui mainnet 状态和付费 Walrus 证据。

### 6. 核心技术亮点

#### What-if Strategy Diff：预演，不是伪执行

RiskPilot 的 What-if 系统是隔离的 preview lane。引擎克隆当前 portfolio，应用压力情景，重新计算确定性 risk report，并构建 preview strategy diff。输出会被标记为 `previewOnly: true`；场景也可以带有 market override 或 policy override，例如 DeepBook unavailable 或预算上限减半。

这个 marker 不是展示文案。preview guard 会递归扫描 payload 中的 `previewOnly` 或 `source: what_if_preview`。`/api/execute` 会拒绝这些 payload 执行，`/api/audit` 会拒绝它们替代真实 archive。UI 可以展示模拟 Incident Room 和 Council 输出，但 Prepare/archive 仍然使用真实钱包或选定 judge scenario。

#### 受约束多 Agent 协作

RiskPilot 的 Agent 固定在明确角色内。Risk Analyst 不批准执行；Policy Guard 不发明市场证据；Execution Planner 不绕过钱包确认；Audit Agent 不成为付款方；Manager 可以综合判断，但 final command 来自确定性 posture 和 policy state。

输出也是结构化的：tasks、priorities、findings、evidence refs、handoffs、consensus items、severity、posture 和 final command。即使可选 AI 文案不可用，deterministic fallback 仍然能生成同样的工作流。

#### 可验证证据链

RiskPilot 不止给出建议，还会打包这次决策。

Audit package 包含 portfolio snapshot、wallet scan、risk report、strategy recommendation、policy、policy check、monitor rules、DeepBook evidence、AI explanation、Incident Room、Agent Council、execution result 和 storage metadata。Walrus archive 返回 blob id、blob object id、register digest、certify digest、checksum 和 readback URL。Archive History 可以重新打开最近本地结果；可选 StrategyReceipt 可以把 strategy 与 blob 的关系记录到 Sui mainnet。

```text
Wallet Scan -> Risk Signals -> Strategy -> Policy Gate
-> DeepBook Evidence -> Incident Room -> Agent Council
-> Walrus Blob ID -> Optional StrategyReceipt
```

### 7. 安全边界自查

✅ **Agent 能否自行触发链上交易？** 不能。付费链上动作必须由用户显式点击并用钱包签名。

✅ **What-if 是否与真实执行路径隔离？** 是。preview 输出被标记、隔离，并且提交到执行/归档端点时会被拒绝。

✅ **Walrus 归档是否需要用户钱包签名和付款？** 是。Server-side Walrus archive 已禁用。

✅ **AI 是否能覆盖 Policy Gate 或 action bounds？** 不能。AI 只能改善文案，policy validation、route eligibility、action bounds、final command posture 和 execution mode 都是确定性的。

✅ **Live DeepBook 是否需要显式 opt-in 和钱包确认？** 是。Live Spot 不是默认模式，必须满足路线合规、policy 通过、显式选择和钱包签名。

✅ **评委可以不连钱包完整体验 Demo 吗？** 可以。One-click Judge Demo Mode 可以在无资金、无 secret 的情况下跑完整 workflow。

### 8. 当前实现状态

| 已真实实现并验证 | Demo 模式或可选功能 |
| --- | --- |
| Sui mainnet 钱包余额读取。 | 无钱包评审用 One-click judge scenarios。 |
| Sui owned-object 扫描与分类。 | 可选 AI narrative layer，失败时 deterministic fallback。 |
| 确定性风险引擎与风险信号。 | DeepBook Predict-style protection 在 demo 中保持 prepare-only。 |
| What-if simulation 与 preview guards。 | Live DeepBook Spot 仅在显式合规路线中可用。 |
| Strategy builder 与 wallet-review fallback。 | StrategyReceipt mint 是 archive 后的可选动作。 |
| Policy Gate 与服务端重新校验。 | Local Archive History 是 readback 辅助界面，不是执行来源。 |
| Incident Room 与 Agent Council 输出。 |  |
| DeepBook mainnet SUI/USDC 市场证据。 |  |
| Wallet-paid Walrus archive flow。 |  |
| Audit Package Explorer 展示 raw JSON、checksum、policy、agent 和 market evidence。 |  |
| 风险、policy、What-if、routes、archive、agents、Walrus helpers、DeepBook paths 的回归测试。 |  |

### 9. 未来扩展方向

RiskPilot 可以继续成长为面向 Sui 钱包、DeFi 高阶用户、基金和 DAO treasury 的风险运营层。后续方向包括更丰富的协议适配器、可复用的钱包级 policy mandates、多签审查、可移植 Walrus 合规证据包、更广的 DeepBook 路线覆盖，以及更完整的机构级审计工作流。

长期来看，RiskPilot 的方向不是 AI trader，而是 Web3 钱包的 agentic risk desk：对用户足够可解释，对安全足够有边界，对技术评委足够可验证。

---

## Quick Start

Requirements:

- Node.js 20+
- npm
- Optional: Slush or another Sui wallet browser extension
- Optional: wallet with enough SUI/WAL for Walrus archive payments
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

Useful docs:

- Judge walkthrough: [`docs/judge-walkthrough.md`](docs/judge-walkthrough.md)
- Mainnet verification report: [`docs/mainnet-verification.md`](docs/mainnet-verification.md)
- Extended project introduction: [`docs/project-introduction.md`](docs/project-introduction.md)
- Maintainer runtime state: [`docs/runtime-state.md`](docs/runtime-state.md)
- Optional receipt package: [`move/README.md`](move/README.md)

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

Connected-wallet Walrus archive:

```bash
NEXT_PUBLIC_WALRUS_UPLOAD_RELAY_URL=https://upload-relay.mainnet.walrus.space
NEXT_PUBLIC_WALRUS_READBACK_BASE_URL=https://aggregator.mainnet.walrus.space/v1/blobs
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
src/lib/walrus          Audit packaging plus connected-wallet Walrus archive helpers
src/test                Focused safety and regression tests
move                    Optional StrategyReceipt Move package
```

## Verification

Release checks:

```bash
npm run lint
npm run typecheck
npm test
npm run build
git diff --check
```

Browser smoke should cover Overview, Risk, Strategy, Audit, and Prepare on both `localhost:3000` and `127.0.0.1:3000`.

Connected-wallet manual verification has previously passed in a normal wallet-capable browser. Automation browsers may not expose Slush/provider popups. Do not reset Sui or Walrus configs without reading [`docs/runtime-state.md`](docs/runtime-state.md).

