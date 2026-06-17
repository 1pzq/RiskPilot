'use client';

import { PixelIcon, type PixelIconName } from './pixel-icon';

const disconnectedFlowSteps = [
  {
    label: '上下文',
    detail: '连接 Sui mainnet 钱包，从真实数据开始。',
    badge: '输入',
    icon: 'case',
  },
  {
    label: '风险图谱',
    detail: '用确定性规则评估敞口、信号和损失场景。',
    badge: '规则',
    icon: 'risk',
  },
  {
    label: 'What-if',
    detail: '预览冲击，但不改变真实工作流。',
    badge: '预览',
    icon: 'read',
  },
  {
    label: 'Policy 路由',
    detail: '锁定动作边界、预算、市场和人工确认。',
    badge: '已锁定',
    icon: 'policy',
  },
  {
    label: 'Agent 房间',
    detail: '展示受限 Agent 任务、交接和最终指令。',
    badge: 'AI 文案',
    icon: 'audit',
  },
  {
    label: '审计轨迹',
    detail: '准备动作并归档证据包。',
    badge: 'Walrus',
    icon: 'archive',
  },
] as const;

const connectedFlowSteps = [
  {
    label: 'Wallet',
    detail: '直接读取已连接的 Sui mainnet 余额。',
    badge: 'mainnet',
    icon: 'case',
  },
  {
    label: '对象',
    detail: '附加已拥有的 mainnet 对象和协议线索。',
    badge: '扫描',
    icon: 'read',
  },
  {
    label: '风险图谱',
    detail: '防止未定价资产生成假的 DeepBook 交易。',
    badge: '规则',
    icon: 'risk',
  },
  {
    label: 'What-if',
    detail: '预览冲击，同时保留真实钱包状态。',
    badge: '预览',
    icon: 'strategy',
  },
  {
    label: 'Policy 路由',
    detail: '确认预算、资产、市场、过期时间和审批锁。',
    badge: '已锁定',
    icon: 'policy',
  },
  {
    label: '审计轨迹',
    detail: '准备 mainnet 动作并归档决策包。',
    badge: 'Walrus',
    icon: 'archive',
  },
] as const;

type DemoFlowPanelProps = {
  walletConnected: boolean;
};

export function DemoFlowPanel({ walletConnected }: DemoFlowPanelProps) {
  const flowSteps = walletConnected ? connectedFlowSteps : disconnectedFlowSteps;

  return (
    <section className="panel demoFlowPanel">
      <div className="panelHeader">
        <div>
          <p className="eyebrow">{walletConnected ? '钱包流程' : '评审流程'}</p>
          <h2 className="panelTitle">
            {walletConnected ? '真实钱包风险工作流' : '仅 Prepare 的风险工作流'}
          </h2>
        </div>
        <span className="pill pillAccent">不默认提交 Live</span>
      </div>

      <div className="flowGrid">
        {flowSteps.map(({ label, detail, badge, icon }, index) => (
          <div className="flowStep" key={label}>
            <PixelIcon name={icon as PixelIconName} className="flowStepIcon" />
            <div>
              <em>{badge}</em>
              <strong>{index + 1}. {label}</strong>
              <span>{detail}</span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
