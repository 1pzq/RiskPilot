# Sui Overflow 2026 Optimization Plan

本文档用于把 RiskPilot 从“当前可演示版本”推进到“更适合 Sui Overflow 2026 Agentic Web 赛道提交和现场评审的版本”。计划不按日期拆分，而按可验收的 Step 推进。每个 Step 都包含任务目标、交付物、Agent 分工、中间产物、质量标准和执行顺序。

当前产品定位：

RiskPilot 是 Sui 钱包的 agentic risk desk：确定性规则负责决策，AI agents 负责解释与协作，DeepBook 提供市场动作依据，Walrus 保存可验证审计链。

主赛道选择：

- 主赛道：Agentic Web。
- DeepBook 定位：agent 决策中的市场证据和受限动作依据，不作为主赛道叙事。
- Walrus 定位：agent 金融行为的可验证审计层，不作为独立存储产品叙事。
- 核心安全句：AI agents investigate and explain; deterministic policy decides; wallets sign paid actions.

整体优化原则：

- 每个新增 UI、文案和 proof 都必须服务 Agentic Web 主叙事。
- 不把 RiskPilot 讲成自动交易 bot。
- 不把 DeepBook 或 Walrus 硬讲成主产品；它们是 agentic workflow 的 proof rails。
- demo 优先展示 agent 调查、agent 交接、policy 约束和可审计结果。

Agentic Web 评审主线：

- `Investigate`: AI agents 读取钱包/场景、风险信号、市场证据和用户约束。
- `Deliberate`: 专门角色分工讨论 downside、market action、policy boundary 和 archive readiness。
- `Constrain`: deterministic policy gate 决定 agent 可以建议什么、不能执行什么。
- `Prepare`: wallet-paid actions 只在用户显式确认后进入 Prepare/archive。
- `Prove`: Walrus 保存 agent final command、policy snapshot、DeepBook evidence 和 wallet-paid proof。

评委必须能在 10 秒内回答四个问题：

- 这个 agent 做了什么调查？
- 哪些 deterministic rules 限制了它？
- 它使用了哪些 Sui-native tools/proof rails？
- 如果它出错或被拒签，用户如何追溯？

## Step 1: Stabilize Wallet And Demo Baseline

### 1. 本次任务目标

- 确认 Slush / Sui wallet 连接流程稳定可演示。
- 确认 connected-wallet 模式不会混入 judge demo 假数据。
- 确认无钱包时 Judge Demo Mode 能完整跑通主流程。
- 建立一条不会因为钱包弹窗失败而中断的 fallback demo path。
- 建立 Agentic Web 主 demo baseline：即使不连接钱包，也能展示 agents investigate -> deliberate -> constrain -> prepare -> prove 的完整链路。

### 2. 最终交付物结构

- `Wallet Connect Verification`
  - Connect wallet 按钮可点击。
  - Slush / Sui wallet 弹窗可触发。
  - 连接后顶部状态进入 connected-wallet 模式。
  - 断开、刷新、autoConnect 行为有明确记录。

- `Connected Wallet Data Boundary`
  - Overview 显示 Wallet Health Summary。
  - Portfolio 使用真实 mainnet wallet rows。
  - 不混入 demo lending / LP 假数据。

- `Judge Demo Fallback Path`
  - 不连接钱包也能走 Overview -> Risk -> Strategy -> Audit -> Prepare。
  - Prepare archive 按钮在未连接钱包时保持 disabled。
  - 文案明确说明 paid archive 需要连接钱包。
  - 主流程文案按 agent 决策链组织，而不是按 dashboard 页面列表组织。

- `Agentic Demo Spine`
  - Overview 展示 agentic risk desk 定位。
  - Risk 展示 deterministic signals。
  - Strategy 展示 agent recommendation 被 policy 和 market evidence 约束。
  - Audit 展示 agent handoff / council / evidence timeline。
  - Prepare 展示 wallet-paid boundary 和 audit trail。

- `Verification Notes`
  - 更新 `docs/runtime-state.md` 中最新钱包验收结论。
  - 若发现钱包连接问题，记录根因和修复方式。

### 3. 参与 Agent 分工

- `Manager`: 总控、最终验收、文档更新。
- `Tesla`: Wallet / Sui Boundary Agent，负责 wallet provider、dapp-kit、network、signer/payer 边界。
- `Turing`: Frontend State Agent，负责 hydration、autoConnect、account state、demo/connected 切换。
- `Noether`: QA / Regression Agent，负责 smoke 清单、回归命令、风险记录。

### 4. 每个 Agent 的中间产物

- `Tesla`
  - 钱包连接链路检查结果。
  - Slush / Sui wallet 兼容性观察。
  - signer / payer / subject wallet 边界验收点。

- `Turing`
  - connected-wallet state 生命周期检查。
  - demo scenario 与 wallet account 切换检查。
  - hydration / localStorage / autoConnect 风险说明。

- `Noether`
  - 浏览器 smoke 路径。
  - 钱包手动验收清单。
  - 自动化回归结果。
  - Judge Demo fallback 是否仍然呈现 Agentic Web story 的检查。

- `Manager`
  - 最终判断。
  - 必要代码修复。
  - runtime-state 更新。

### 5. 质量验收标准

- `npm run lint` 通过。
- `npm run typecheck` 通过。
- `npm test` 通过。
- `npm run build` 通过。
- `git diff --check` 通过。
- Connect wallet 能触发钱包弹窗。
- 连接后 Overview 显示 connected-wallet 模式和 Wallet Health Summary。
- connected-wallet 模式不显示 demo scenario 卡片。
- 未连接钱包时 paid archive disabled。
- Judge Demo Mode 不依赖钱包也能完整展示。
- Judge Demo Mode 能清楚展示 agent 调查、agent 交接、policy 约束和 Walrus proof 这条链。

### 6. 预计执行顺序

1. Manager 启动本地 dev server。
2. Tesla 检查 `providers.tsx`、`wallet-connect.tsx`、dapp-kit 配置和 mainnet network。
3. Turing 检查 account state、demo state、archive history localStorage 是否影响 wallet connect。
4. Manager 用浏览器手动验证 wallet connect / disconnect / refresh。
5. Noether 跑 Overview、Risk、Strategy、Audit、Prepare smoke。
6. Manager 修复发现的问题。
7. Manager 跑完整自动检查。
8. Manager 更新 `docs/runtime-state.md`。
9. Manager 提交本 Step 结果。

## Step 2: Turn DeepBook Into Agent Market Evidence

### 1. 本次任务目标

- 让 DeepBook 成为 Agentic Web workflow 中的“market evidence agent tool”，而不是另一个并列赛道主角。
- 让评委一眼看出 agent 的策略建议不是凭空生成，而是被 DeepBook 市场状态、eligibility 和 policy gate 约束。
- 把 DeepBook / DeepBook Predict-style protection 从“后端能力”提升为 agent 调查链中的可见证据。
- 保持 prepare-first，不把 live trading 变成默认路径。

### 2. 最终交付物结构

- `Agent Market Evidence Panel`
  - 展示 SUI/USDC 或目标市场证据。
  - 展示 pool / route / liquidity / quote 状态。
  - 展示 DeepBook evidence 是 ready、unavailable、not eligible 还是 review-only。
  - 明确标记该 evidence 被哪个 agent 使用，以及如何进入 final recommendation。

- `Agent Tool Eligibility Explanation`
  - 明确说明为什么可以或不可以进入 live Spot。
  - 明确说明为什么当前推荐是 prepare-only、Predict-style、wallet review 或 live-eligible。
  - 明确说明 AI agent 不能越过 eligibility 或 policy。

- `Strategy Copy Polish`
  - 策略页文案更像 agent 调查后的风险保护方案，而不是普通建议。
  - DeepBook role 在 Strategy 和 Prepare 两处都可见，但叙事上服务 Agentic Web。

- `Docs Update`
  - 更新 README / judge walkthrough 中 DeepBook 的讲法：DeepBook 是 agent market evidence rail。

### 3. 参与 Agent 分工

- `Manager`: 定义产品边界，整合 UI 和文档。
- `Tesla`: DeepBook / Sui Execution Boundary Agent，负责 live eligibility、chain、transaction safety。
- `Bernoulli`: UX Layout Agent，负责 Agent Market Evidence panel 信息架构。
- `Turing`: Agent State Agent，负责 DeepBook evidence 如何进入 agent room、strategy 和 audit package。
- `Noether`: QA Agent，负责 DeepBook eligible / not eligible / review-only 测试路径。

### 4. 每个 Agent 的中间产物

- `Tesla`
  - DeepBook evidence 当前数据来源说明。
  - live Spot eligibility 条件表。
  - 不执行时的安全理由。

- `Bernoulli`
  - Agent Market Evidence panel wireframe。
  - Strategy / Prepare 两处展示建议。
  - 哪些技术字段需要转译成评委能懂的文案。

- `Turing`
  - DeepBook evidence 在 agent workflow 中的数据流。
  - evidence 是否进入 audit package 的检查。
  - DeepBook unavailable 时 agent fallback 状态说明。

- `Noether`
  - DeepBook 状态回归清单。
  - live failure 不触发 Walrus payment 的回归检查。
  - wallet_review 不 invent trade 的测试确认。

- `Manager`
  - 最终 UI 实现。
  - docs/judge-walkthrough 更新。
  - 完整验收总结。

### 5. 质量验收标准

- Strategy 页面能清楚显示 DeepBook 作为 agent market evidence 的角色。
- Prepare 页面能看到 DeepBook action/evidence 如何进入 agent final command 和 Walrus archive。
- live Spot 仍然不是默认选项。
- 不满足 live 条件时，UI 明确说明 blocked reason。
- DeepBook unavailable 时，系统降级为 wallet review 或 prepare-only，不假造交易。
- AI agent 不得把 DeepBook unavailable 改写成可执行交易。
- What-if 仍不能进入 execute / audit / wallet-paid archive。
- 自动检查全部通过。

### 6. 预计执行顺序

1. Tesla 梳理当前 DeepBook helper、market evidence、live gate。
2. Turing 梳理 DeepBook evidence 如何进入 agent workflow、strategy 和 audit package。
3. Bernoulli 设计 Agent Market Evidence panel 在 Strategy / Prepare 的位置。
4. Manager 实现 panel 和文案。
5. Noether 增补或确认 DeepBook 相关测试。
6. Manager 跑自动检查。
7. Manager 用浏览器 smoke Strategy / Prepare。
8. Manager 更新 README 和 judge walkthrough。
9. Manager 提交本 Step 结果。

## Step 3: Upgrade Policy Gate Into Authorization Contract UX

### 1. 本次任务目标

- 把已有 Policy Gate 从“规则检查”升级成 Agentic Web 评委能理解的“agent authority boundary”。
- 让 max budget、allowed market、action mode、expiry、signer、payer 在 UI 上形成完整授权感。
- 不引入真正资金托管，不伪装成链上 PolicyVault 已完成。
- 让 policy gate 成为 Agentic Web 安全卖点：agent 可以调查和建议，但不能越过用户授权。

### 2. 最终交付物结构

- `Authorization Panel`
  - 显示 max budget。
  - 显示 allowed market / token。
  - 显示 selected execution mode。
  - 显示 signer / archive payer。
  - 显示 confirmation required。
  - 显示 blocked reason：agent 为什么不能执行某些动作。

- `Policy Gate Copy`
  - 文案从“配置项”升级成“agent authority boundary”。
  - 明确 AI 不能越过 policy。
  - 明确 deterministic policy 才是最终执行边界。
  - 明确用户钱包才是 paid action 的 signer / payer。

- `Audit Package Extension Check`
  - 确认 audit package 中保留 policy snapshot。
  - 确认 Walrus archive 中能检查 policy evidence。

- `Optional Receipt Context`
  - StrategyReceipt 文案说明其为 post-archive proof，不是自动执行证明。

### 3. 参与 Agent 分工

- `Manager`: 确定不夸大链上授权能力，负责最终实现。
- `Bernoulli`: UX Agent，负责 authorization panel 布局。
- `Turing`: State Agent，负责 policy state 与 archive payload 一致性。
- `Noether`: QA Agent，负责 policy guard 和 preview guard 回归。

### 4. 每个 Agent 的中间产物

- `Bernoulli`
  - Authorization panel 草图。
  - 信息优先级排序。
  - 移动端压缩建议。

- `Turing`
  - policy state -> strategy -> audit package 的数据流检查。
  - policy reset / scenario switch / wallet switch 风险说明。
  - agent recommendation 与 policy result 不一致时的优先级说明。

- `Noether`
  - policy blocked 时 prepare/archive disabled 的检查。
  - What-if preview 不能携带成真实 policy archive 的检查。

- `Manager`
  - UI 和 payload 必要调整。
  - 文档中对 PolicyVault 未完成边界的说明。

### 5. 质量验收标准

- 用户能在 Prepare 前看懂“agent 被允许做什么、不允许做什么、谁付款”。
- policy blocked 时不能 archive。
- policy snapshot 进入 audit package。
- UI 不宣称已经完成 on-chain PolicyVault。
- AI 文案不能暗示 agent 可以绕过 authorization。
- agent recommendation 与 policy gate 冲突时，policy gate 必须胜出。
- 移动端无横向溢出。
- 自动检查全部通过。

### 6. 预计执行顺序

1. Turing 梳理 policy state 和 audit payload。
2. Bernoulli 设计 authorization panel。
3. Manager 实现 UI 和必要数据映射。
4. Noether 跑 policy/preview/archive guard 测试。
5. Manager 浏览器 smoke Prepare。
6. Manager 更新 docs。
7. Manager 提交本 Step 结果。

## Step 4: Make Walrus The Agent Audit Trail

### 1. 本次任务目标

- 把 Walrus archive 从“技术成功”变成 Agentic Web 评委容易验证的 agent audit trail。
- 让评委看到每次 agent 调查、policy 决策、market evidence 和 wallet-paid archive 都能被追溯。
- 让 audit id、blob id、register digest、certify digest、readback URL 可以一键复制和复述。
- 强化 Archive History 的“可复用证据库”感觉。

### 2. 最终交付物结构

- `Copy Agent Proof Summary`
  - 一键复制 audit id。
  - 一键复制 Walrus blob id。
  - 一键复制 register / certify digest。
  - 一键复制 readback URL。
  - 摘要中明确包含 agent decision、policy boundary、market evidence、wallet payer。

- `Agent Audit Trail Panel`
  - 在 archive 成功后显示简洁证明摘要。
  - 可区分 pending / certified / loaded from history。
  - 显示 final command 来自 agent workflow，但执行边界来自 deterministic policy。

- `Archive History Polish`
  - 最近 archive 卡片更清晰。
  - active result 更明显。
  - Verify Walrus 链接更像主要 audit action。

- `Docs Update`
  - judge walkthrough 增加 agent audit trail 讲法。

### 3. 参与 Agent 分工

- `Manager`: 总控与实现。
- `Bernoulli`: Proof UX Agent，负责 agent audit trail / history polish。
- `Turing`: Browser State Agent，负责 clipboard、history load、active archive state。
- `Noether`: QA Agent，负责 archive history 和 malformed storage 回归。

### 4. 每个 Agent 的中间产物

- `Bernoulli`
  - Agent audit trail 视觉结构。
  - copy button 位置建议。
  - Archive History 强弱层级建议。

- `Turing`
  - Clipboard API fallback 建议。
  - history entry load 后状态一致性检查。
  - localStorage failure 处理建议。
  - loaded history 不触发 agent rerun / wallet payment 的检查。

- `Noether`
  - archive history 测试结果。
  - malformed entry 恢复测试结果。
  - copy action 手动验收清单。

- `Manager`
  - 最终组件实现。
  - docs/judge-walkthrough 更新。
  - commit。

### 5. 质量验收标准

- archive 成功后，agent audit trail 在首屏或近首屏可见。
- Copy agent proof summary 成功或给出明确 fallback。
- Archive History 打开旧结果不会触发执行或付款。
- Verify Walrus 链接不依赖私钥。
- 本地 history 损坏时页面不崩。
- Walrus proof 明确证明 agent workflow 的结果，而不是伪装成交易收益证明。
- 自动检查全部通过。

### 6. 预计执行顺序

1. Bernoulli 设计 agent audit trail 和 archive history 层级。
2. Turing 检查 copy/history 状态逻辑。
3. Manager 实现 copy agent proof summary。
4. Noether 跑 archive history 测试和浏览器手动检查。
5. Manager 更新 judge walkthrough。
6. Manager 提交本 Step 结果。

## Step 5: Polish Agentic Web Story

### 1. 本次任务目标

- 让 Incident Room、Agent Council、Evidence Timeline 成为主赛道核心展示，而不是普通 AI 文案区。
- 突出“agents brief, compare, hand off, explain; deterministic rules decide”。
- 明确 RiskPilot 选择 Agentic Web 作为唯一提交赛道。
- 让评委在 10 秒内理解：这是一个有工具、有边界、有证据链的 Sui agent workflow。
- 把 demo 话术从“功能页面导览”改成“agent 决策链演示”。

### 2. 最终交付物结构

- `Judge-Facing Value Statement`
  - Overview 或 stage intro 中加入一句短而硬的项目定位。
  - 不做营销长文，不挤占主操作。
  - 明确标记主赛道：Agentic Web。
  - 使用统一英文句：AI agents investigate; deterministic policy decides; wallets sign; Walrus proves.

- `Agent Room Polish`
  - 每个 agent 角色、任务、handoff 更清楚。
  - Incident Room 输出更像执行室简报。
  - Agent Council 输出更像多方审议。
  - Manager final command 明确引用 risk signals、policy gate、DeepBook evidence 和 Walrus archive boundary。
  - 每个 agent 至少有一个明确输入和一个明确输出，避免看起来像普通聊天面板。

- `Evidence Timeline Polish`
  - 明确哪些证据来自 deterministic engine。
  - 明确哪些文本来自 AI narrative。
  - 明确最终 archive 的证据来源。
  - 明确 agent handoff 如何进入 audit package。
  - Timeline 顺序贴合 Investigate -> Deliberate -> Constrain -> Prepare -> Prove。

- `Fallback Narrative`
  - AI provider 缺失时，deterministic fallback 不显得像错误。
  - fallback 仍然表现为 bounded agent workflow，而不是静态报告。

- `Demo Script Rewrite`
  - 30 秒 pitch 按 Agentic Web 主线讲。
  - 3 分钟 walkthrough 按 agent 决策链讲。
  - DeepBook 和 Walrus 只作为 tools/proof rails 出现，不抢主赛道。

### 3. 参与 Agent 分工

- `Manager`: Agentic Web 主叙事和最终文案裁剪。
- `Bernoulli`: UX Agent，负责页面层级和评委可读性。
- `Turing`: AI State Agent，负责 provider failure / deterministic fallback 状态。
- `Noether`: QA Agent，负责 API route 和 fallback 回归。

### 4. 每个 Agent 的中间产物

- `Bernoulli`
  - Agent Room 信息架构建议。
  - 哪些文案要上提，哪些要折叠。
  - Agentic Web 价值句的页面位置建议。
  - 30 秒内评委能扫到的视觉锚点清单。

- `Turing`
  - AI provider missing / failed 的 fallback 状态检查。
  - agent outputs 与 policy/execution 不互相覆盖的检查。
  - agent handoff / final command / audit package 数据一致性检查。

- `Noether`
  - `/api/explain`、`/api/incident-room`、`/api/agent-council` 回归清单。
  - deterministic fallback 快照。
  - AI provider missing 时 demo 话术仍成立的检查。

- `Manager`
  - 最终文案。
  - 必要 UI 调整。
  - docs/project-introduction 或 judge walkthrough 更新。
  - 30 秒 pitch 和 3 分钟 walkthrough 的最终版本。

### 5. 质量验收标准

- 评委 10 秒内能理解 Agentic Web 是主赛道。
- AI 输出不会暗示已经执行交易。
- AI fallback 不制造全局错误噪音。
- Agent Room 不遮挡主流程。
- Agent handoff、policy boundary、market evidence、audit trail 之间有清楚链路。
- 页面和文档不再把 demo 讲成普通 Dashboard 导览。
- 30 秒 pitch 中必须出现：agent investigate、policy decides、wallet signs、Walrus proves。
- 自动检查全部通过。

### 6. 预计执行顺序

1. Manager 定义一句 Agentic Web 主叙事和 30 秒 pitch 骨架。
2. Bernoulli 检查 Overview / Audit / Agent Room 层级。
3. Turing 检查 AI fallback 数据流。
4. Manager 调整文案和 UI。
5. Noether 跑 API route tests。
6. Manager 浏览器 smoke Audit。
7. Manager 更新 judge walkthrough 和 project introduction。
8. Manager 检查 README / runtime-state 是否仍然一致。
9. Manager 提交本 Step 结果。

## Step 6: Final Submission Hardening

### 1. 本次任务目标

- 冻结大功能，只做 bug fix、文案、截图、提交材料。
- 确保项目可以在没有钱包、钱包失败、AI provider 缺失三种情况下仍然有完整 demo。
- 准备 Agentic Web 赛道最终提交包。

### 2. 最终交付物结构

- `Release Candidate`
  - 所有代码提交完成。
  - 工作区干净。
  - main 分支和远端同步。

- `Final Verification Report`
  - 自动检查结果。
  - Browser smoke 结果。
  - 钱包手动验收结果。
  - Walrus archive / readback 证据。
  - secret scan 结果。

- `Submission Assets`
  - README final。
  - 30 秒 pitch。
  - 3 分钟 judge walkthrough。
  - 核心截图。
  - demo fallback notes。
  - Agentic Web 主赛道说明。
  - DeepBook / Walrus 作为 proof rails 的说明。
  - 一页式 Agentic Web evidence map：agent roles、tools、policy boundary、Walrus proof。

### 3. 参与 Agent 分工

- `Manager`: Release owner，最终提交判断。
- `Tesla`: Wallet / chain / DeepBook / Walrus 最终边界验收。
- `Bernoulli`: UI / screenshot / responsive polish。
- `Turing`: App state / fallback / route state 验收。
- `Noether`: 全量 QA、secret scan、release checklist。

### 4. 每个 Agent 的中间产物

- `Tesla`
  - Sui mainnet、wallet、DeepBook、Walrus 作为 agent tools/proof rails 的最终验收报告。
  - 不可演示风险清单。

- `Bernoulli`
  - 核心截图清单。
  - 移动端和桌面 UI 风险清单。

- `Turing`
  - fallback demo path 验证。
  - query param / route state / localStorage 检查。
  - AI provider missing 时 Agentic Web demo 仍成立的验证。

- `Noether`
  - 完整自动检查输出。
  - Browser smoke 表。
  - secret scan 结果。

- `Manager`
  - final README / walkthrough。
  - release commit。
  - push / submission notes。

### 5. 质量验收标准

- `npm run lint` 通过。
- `npm run typecheck` 通过。
- `npm test` 通过。
- `npm run build` 通过。
- `git diff --check` 通过。
- secret scan 不出现真实 key / 私钥 / 助记词。
- Browser smoke 覆盖 Overview、Risk、Strategy、Audit、Prepare。
- Judge Demo Mode 完整可走。
- connected-wallet 手动验收通过或记录明确风险。
- Walrus proof 可验证或有 fallback proof 说明。
- README 和 walkthrough 明确主赛道为 Agentic Web。
- DeepBook 和 Walrus 被描述为 agent workflow 的工具和证明层，而不是分散主赛道。
- 最终提交材料中不出现“AI 自动交易”或“自动对冲收益保证”的暗示。
- 最终 demo 能在钱包失败和 AI provider 缺失时仍然展示 Agentic Web 核心价值。
- README、judge walkthrough、runtime-state 互相不冲突。
- 工作区干净，最终 commit 已 push。

### 6. 预计执行顺序

1. Manager 冻结功能范围。
2. Noether 跑完整自动检查。
3. Bernoulli 做桌面 / 移动端截图检查。
4. Tesla 做钱包、DeepBook、Walrus 手动验收。
5. Turing 做 fallback path 验收。
6. Manager 修最后一轮 bug。
7. Manager 更新 README、judge walkthrough、runtime-state。
8. Noether 做 secret scan 和 final regression。
9. Manager 创建 release commit。
10. Manager push 到远端。
11. Manager 输出最终提交说明。
