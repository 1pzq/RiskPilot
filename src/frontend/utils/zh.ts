const statusLabels: Record<string, string> = {
  idle: 'Idle',
  loading: 'Loading',
  ready: 'Ready',
  error: 'Error',
  fallback: 'Rules fallback',
  mock: 'Mock copy',
  deepseek: 'DeepSeek',
  openai: 'OpenAI',
  blocked: 'Blocked',
  watch: 'Watching',
  waiting: 'Waiting',
  clear: 'Clear',
  agree: 'Agree',
  passed: 'Passed',
  prepared: 'Prepared',
  submitted: 'Submitted',
  confirmed: 'Confirmed',
  failed: 'Failed',
  complete: 'Complete',
  pending: 'Pending',
  certified: 'Certified',
  deterministic_fallback: 'Rules fallback',
  policy_blocked: 'Policy blocked',
  live_ready: 'Live ready',
  audit_only: 'Audit only',
  prepare_ready: 'Prepare ready',
  prepare_mainnet: 'Prepare mainnet',
  mainnet: 'mainnet',
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  critical: 'Critical',
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
    return 'Not recorded';
  }

  return statusLabels[value] ?? value.replace(/_/g, ' ');
}

export function zhRole(value: string): string {
  return roleLabels[value] ?? value;
}

export function zhYesNo(value: boolean | undefined): string {
  if (typeof value !== 'boolean') {
    return 'Unknown';
  }

  return value ? 'Yes' : 'No';
}

export function zhSourceLabel(value: string): string {
  if (value === 'mainnet wallet') {
    return 'mainnet wallet';
  }

  if (value === 'local sample') {
    return 'local sample';
  }

  return value;
}

export function zhDisplayText(value: string | undefined | null): string {
  if (!value) {
    return '';
  }

  const exact: Record<string, string> = {
    'Connected wallet': 'Connected wallet',
    'Connected wallet required': 'Connected wallet required',
    'No wallet signature': 'No wallet signature',
    'No chain payment': 'No chain payment',
    'Not connected': 'Not connected',
    'Blocked': 'Blocked',
    'No trade': 'No trade',
    'N/A': 'N/A',
    'not recorded': 'not recorded',
    pending: 'Pending',
    open: 'Open',
    empty: 'Empty',
    unknown: 'Unknown',
    registered: 'Registered',
    unregistered: 'Unregistered',
    whitelisted: 'Whitelisted',
    clear: 'Clear',
    openai: 'OpenAI',
    deepseek: 'DeepSeek',
    mock: 'Mock copy',
  };

  if (exact[value]) {
    return exact[value];
  }

  return value
    .replaceAll('Wallet required', 'Wallet required')
    .replaceAll('prepare-only', 'Prepare only')
    .replaceAll('prepare mainnet', 'Prepare mainnet')
    .replaceAll('live mainnet', 'Live mainnet')
    .replaceAll('rules fallback', 'rules fallback')
    .replaceAll('not archived', 'not archived')
    .replaceAll('estimated', 'estimated')
    .replaceAll('recorded', 'recorded')
    .replaceAll('missing', 'missing')
    .replaceAll('passed', 'passed')
    .replaceAll('blocked', 'blocked')
    .replaceAll('ready', 'ready')
    .replaceAll('watch', 'watch')
    .replaceAll('waiting', 'waiting');
}
