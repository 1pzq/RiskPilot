# RiskPilot Project Introduction

## 中文版

### 一句话

RiskPilot 是一个面向 Sui DeFi 钱包风险的 Agentic Web 指挥舱：多个受约束 Agent 读取真实钱包或一键 judge scenario，完成风险研判、What-if Strategy Diff、政策门控建议，并通过 DeepBook / Walrus / Sui mainnet 保存从 Wallet Scan 到 Receipt 的证据链。

### 项目定位

RiskPilot 的 Sui Overflow 2026 主赛道叙事是 **Agentic Web**。它不是把聊天机器人放到 DeFi 页面旁边，而是把风险处理组织成一个可审计的多 Agent 工作流。

- Sui mainnet 提供真实钱包余额和 owned object 状态。
- DeepBook 提供市场证据和有边界的风险动作路线。
- Walrus 保存可验证 audit package。
- StrategyReceipt 提供可选的链上收据。

### 核心价值

Sui DeFi 用户经常面对三个问题：

- 钱包资产和 DeFi 对象分散，普通用户很难快速理解真实风险。
- AI agent 的建议如果不可审计，很难被用户、团队或评委信任。
- 风险管理和交易执行之间缺少清晰边界，容易把“建议”误变成“自动交易”。

RiskPilot 的答案是：让 AI 帮用户解释和组织风险，但把执行权留给确定性政策和用户确认。

### 核心功能

- **真实钱包读取**：连接 Sui 主网钱包，读取 coin balances，扫描 owned objects，并分类 DeepBook、Walrus、receipt、DeFi candidate、coin object、package cap 等对象。连接钱包后不混入 demo lending/LP 仓位。
- **确定性风险引擎**：识别 SUI downside、资产集中度、稳定币、借贷健康度、LP、未知资产和钱包对象风险。
- **What-if Risk Simulator**：预览 SUI 下跌、DeepBook 流动性变薄、未知资产流入、借贷健康度下降、policy budget 收紧和 DeepBook 不可用等压力情景。
- **What-if Strategy Diff**：对照基础策略和压力情景策略，解释风险信号、agent findings 和 policy 结果如何变化。
- **Agentic Incident Room**：Manager 分派 Risk Analyst、Liquidity Scout、Policy Guard、Execution Planner、Audit Agent 的任务，并展示 findings、handoffs、consensus 和锁定 final command。
- **Agent Council**：风险委员会视角，展示 Risk Analyst、Strategy Agent、Policy Guard、Audit Agent 和 Manager synthesis。
- **Policy Gate**：用户设定预算、单笔上限、允许资产、允许市场、有效期和人工确认要求；任何 prepare 或 live spot 路径都必须通过 policy check。
- **DeepBook Evidence**：读取主网 SUI/USDC 市场证据；DeepBook Predict-style 路线保持 prepare-only；live spot 仅限显式 opt-in 的合规路径。
- **Walrus Audit Archive**：将 portfolio、risk report、recommendation、policy、AI explanation、monitor rules、DeepBook evidence、Incident Room、Agent Council 和 execution result 打包归档。
- **Audit Package Explorer**：prepare/archive 后展开证据包，检查 digest、risk delta、policy result、DeepBook evidence、storage provider、checksum 和 raw JSON。
- **StrategyReceipt**：归档后可选 mint Sui 主网 receipt，记录 strategy id、Walrus blob id 和 execution digest。

### 安全边界

- 默认执行模式是 `prepare_mainnet`。
- What-if 是 estimated preview，不能进入真实 execute/archive、Walrus payload、receipt mint 或 live execution。
- AI 只增强 explanation、briefing、task findings、deliberation 和 summary。
- AI 不能覆盖 `policyCheck`、action bounds、Incident Room final command/handoff、DeepBook eligibility、archive behavior 或 `prepare_mainnet` 默认值。
- unknown/unpriced coins 不会触发伪造交易。
- `.env.local`、provider key、私钥、seed phrase 和 proxy secret 永远不进入源码、文档、截图或提交。

### 演示闭环

Overview -> Risk -> What-if -> Strategy -> Audit -> Prepare

评委可以先用 One-click Judge Demo Mode 在无钱包状态下跑完整路径；也可以连接 Sui 主网钱包查看真实余额、对象扫描和 wallet-first 风险报告。

---

## English Version

### One-Liner

RiskPilot is an Agentic Web incident room for Sui DeFi risk: bounded agents triage real wallets or one-click judge scenarios, run What-if Strategy Diffs, propose policy-gated actions, and preserve the Wallet Scan-to-Receipt evidence chain with DeepBook, Walrus, and Sui mainnet support.

### Positioning

RiskPilot's Sui Overflow 2026 primary track narrative is **Agentic Web**. It is not a chatbot beside a DeFi dashboard; it turns wallet risk into an auditable multi-agent workflow.

- Sui mainnet provides live wallet balances and owned-object state.
- DeepBook provides market evidence and bounded risk-action routes.
- Walrus preserves the verifiable audit package.
- StrategyReceipt provides optional on-chain receipt proof.

### Problem

Sui DeFi users face three practical problems:

- Wallet assets and DeFi objects are fragmented, making real risk hard to understand quickly.
- AI recommendations are difficult to trust if reasoning and execution context are not auditable.
- Risk analysis and transaction execution need a clear safety boundary so advice does not silently become automated trading.

RiskPilot lets AI help explain and coordinate risk, while deterministic policy and user approval keep execution authority locked.

### Core Features

- **Real wallet reading**: reads Sui mainnet balances and owned objects, classifies DeepBook, Walrus, receipt, DeFi candidate, coin, and package-cap objects, and never mixes demo lending/LP positions into connected-wallet mode.
- **Deterministic risk engine**: scores downside, concentration, stablecoin, lending, LP, unknown asset, and wallet-object risk.
- **What-if Risk Simulator**: previews SUI drawdowns, thinner DeepBook liquidity, unknown asset inflows, lending health slips, tighter policy budgets, and DeepBook unavailability.
- **What-if Strategy Diff**: compares base and stressed strategy posture while keeping simulated output preview-only.
- **Agentic Incident Room**: Manager assigns Risk Analyst, Liquidity Scout, Policy Guard, Execution Planner, and Audit Agent tasks, then shows findings, handoffs, consensus, and locked final command.
- **Agent Council**: shows a committee view with Risk Analyst, Strategy Agent, Policy Guard, Audit Agent, and Manager synthesis.
- **Policy Gate**: enforces budget, single-trade cap, allowed assets, allowed markets, expiry, and manual approval before prepare or live spot routes.
- **DeepBook Evidence**: reads mainnet SUI/USDC market evidence; DeepBook Predict-style protection remains prepare-only; live spot is explicit opt-in only.
- **Walrus Audit Archive**: stores portfolio, risk, recommendation, policy, AI explanation, monitor rules, DeepBook evidence, Incident Room, Agent Council, and execution result.
- **Audit Package Explorer**: lets judges inspect digest, risk delta, policy result, DeepBook evidence, storage provider, checksum, and raw JSON.
- **StrategyReceipt**: optionally mints a Sui mainnet receipt after archive.

### Safety Boundaries

- Default execution mode is `prepare_mainnet`.
- What-if is estimated preview data and cannot enter real execute/archive, Walrus payloads, receipt minting, or live execution.
- AI only improves explanation, briefing, task findings, deliberation, and summary.
- AI cannot override `policyCheck`, action bounds, Incident Room final command/handoff, DeepBook eligibility, archive behavior, or the `prepare_mainnet` default.
- Unknown or unpriced coins cannot create synthetic trades.
- `.env.local`, provider keys, private keys, seed phrases, and proxy secrets never belong in source, docs, screenshots, or commits.

### Demo Loop

Overview -> Risk -> What-if -> Strategy -> Audit -> Prepare

Judges can use One-click Judge Demo Mode without funds or secrets, then optionally connect a Sui mainnet wallet to verify the real-wallet path.
