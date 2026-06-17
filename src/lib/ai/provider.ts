export type AiProviderMode = 'mock' | 'deepseek' | 'openai';
export type AiApiMode = 'responses' | 'chat';

export type AiProviderConfig = {
  apiKey?: string;
  baseURL?: string;
  model: string;
  provider: Exclude<AiProviderMode, 'mock'>;
  apiMode: AiApiMode;
  reasoningEffort?: 'none' | 'minimal' | 'low' | 'medium' | 'high' | 'xhigh';
};

export function normalizeAiApiMode(value: string | undefined, provider: AiProviderConfig['provider']): AiApiMode {
  if (value?.toLowerCase() === 'responses') {
    return 'responses';
  }

  if (value?.toLowerCase() === 'chat') {
    return 'chat';
  }

  return provider === 'deepseek' ? 'chat' : 'responses';
}

export function normalizeReasoningEffort(value: string | undefined): AiProviderConfig['reasoningEffort'] {
  const normalized = value?.toLowerCase();
  return normalized === 'none' ||
    normalized === 'minimal' ||
    normalized === 'low' ||
    normalized === 'medium' ||
    normalized === 'high' ||
    normalized === 'xhigh'
    ? normalized
    : undefined;
}

export function getAiProviderConfig(): AiProviderConfig {
  const deepseekApiKey = process.env.DEEPSEEK_API_KEY?.trim();
  const openAiCompatibleApiKey = process.env.OPENAI_API_KEY?.trim();
  const deepseekBaseURL = process.env.DEEPSEEK_BASE_URL?.trim();
  const openAiCompatibleBaseURL = process.env.OPENAI_BASE_URL?.trim();
  const configuredModel = process.env.DEEPSEEK_MODEL?.trim() || process.env.OPENAI_MODEL?.trim();
  const configuredBaseURL = deepseekBaseURL || openAiCompatibleBaseURL;
  const provider =
    deepseekApiKey ||
    deepseekBaseURL ||
    configuredBaseURL?.toLowerCase().includes('deepseek') ||
    configuredModel?.toLowerCase().includes('deepseek')
      ? 'deepseek'
      : 'openai';
  const model = configuredModel || (provider === 'deepseek' ? 'deepseek-chat' : 'gpt-5.5');
  const apiMode = normalizeAiApiMode(process.env.DEEPSEEK_API_MODE || process.env.OPENAI_API_MODE, provider);

  return {
    apiKey: deepseekApiKey || openAiCompatibleApiKey,
    baseURL: configuredBaseURL || (provider === 'deepseek' ? 'https://api.deepseek.com' : undefined),
    model,
    provider,
    apiMode,
    reasoningEffort: normalizeReasoningEffort(
      process.env.DEEPSEEK_REASONING_EFFORT || process.env.OPENAI_REASONING_EFFORT,
    ),
  };
}

export function missingAiProviderMessage(config = getAiProviderConfig()): string {
  return config.provider === 'deepseek'
    ? 'DeepSeek API key is not configured.'
    : 'OpenAI-compatible API key is not configured.';
}
