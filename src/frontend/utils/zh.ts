const statusLabels: Record<string, string> = {
  idle: '待命',
  loading: '加载中',
  ready: '就绪',
  error: '错误',
  fallback: '规则兜底',
  mock: '模拟文案',
  deepseek: 'DeepSeek',
  openai: 'OpenAI',
  blocked: '已阻断',
  watch: '观察中',
  waiting: '等待中',
  clear: '清晰',
  agree: '同意',
  passed: '通过',
  prepared: '已准备',
  submitted: '已提交',
  confirmed: '已确认',
  failed: '失败',
  complete: '完成',
  pending: '待处理',
  certified: '已认证',
  deterministic_fallback: '规则兜底',
  policy_blocked: 'Policy 阻断',
  live_ready: 'Live 就绪',
  audit_only: '仅审计',
  prepare_ready: 'Prepare 就绪',
  prepare_mainnet: 'Prepare mainnet',
  mainnet: 'mainnet',
  low: '低',
  medium: '中',
  high: '高',
  critical: '严重',
};

const roleLabels: Record<string, string> = {
  Manager: 'Manager',
  'Risk Analyst': 'Risk Analyst',
  'Strategy Agent': 'Strategy Agent',
  'Policy Guard': 'Policy Guard',
  'Liquidity Scout': 'Liquidity Scout',
  'Execution Planner': 'Execution Planner',
  'Audit Agent': 'Audit Agent',
};

export function zhStatus(value: string | undefined | null): string {
  if (!value) {
    return '未记录';
  }

  return statusLabels[value] ?? value.replace(/_/g, ' ');
}

export function zhRole(value: string): string {
  return roleLabels[value] ?? value;
}

export function zhYesNo(value: boolean | undefined): string {
  if (typeof value !== 'boolean') {
    return '未知';
  }

  return value ? '是' : '否';
}

export function zhSourceLabel(value: string): string {
  if (value === 'mainnet wallet') {
    return 'mainnet 钱包';
  }

  if (value === 'local sample') {
    return '本地样例';
  }

  return value;
}

export function zhDisplayText(value: string | undefined | null): string {
  if (!value) {
    return '';
  }

  const exact: Record<string, string> = {
    'Connected wallet': '已连接钱包',
    'Connected wallet required': '需要连接钱包',
    'No wallet signature': '无钱包签名',
    'No chain payment': '无链上付款',
    'Not connected': '未连接',
    'Blocked': '已阻断',
    'No trade': '无交易',
    'N/A': '不适用',
    'not recorded': '未记录',
    pending: '待处理',
    open: '已打开',
    empty: '空',
    unknown: '未知',
    registered: '已注册',
    unregistered: '未注册',
    whitelisted: '白名单',
    clear: '清晰',
    openai: 'OpenAI',
    deepseek: 'DeepSeek',
    mock: '模拟文案',
  };

  if (exact[value]) {
    return exact[value];
  }

  return value
    .replaceAll('Connected ', '已连接 ')
    .replaceAll('Wallet required', '需要连接钱包')
    .replaceAll('mainnet wallet', 'mainnet 钱包')
    .replaceAll('local sample', '本地样例')
    .replaceAll('prepare-only', '仅 Prepare')
    .replaceAll('prepare mainnet', 'Prepare mainnet')
    .replaceAll('live mainnet', 'Live mainnet')
    .replaceAll('rules fallback', '规则兜底')
    .replaceAll('AI wording', 'AI 文案')
    .replaceAll('Deterministic', '确定性规则')
    .replaceAll('Chain proof', '链上证明')
    .replaceAll('not archived', '未归档')
    .replaceAll('estimated', '估算')
    .replaceAll('recorded', '已记录')
    .replaceAll('missing', '缺失')
    .replaceAll('passed', '通过')
    .replaceAll('blocked', '已阻断')
    .replaceAll('ready', '就绪')
    .replaceAll('watch', '观察中')
    .replaceAll('waiting', '等待中');
}
