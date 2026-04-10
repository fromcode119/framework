import { ApiVersionUtils } from '@fromcode119/core/client';
import { AssistantConstants } from '../admin-assistant-core';
import { AdminAssistantPageUtils } from './admin-assistant-page-utils';
import type { AssistantSkill, AssistantToolOption } from '../admin-assistant-core';

export class AdminAssistantPageGatewayService {
  static async fetchIntegration(api: any): Promise<{
    provider: string;
    model: string;
    baseUrl: string;
    integrationConfigured: boolean;
    hasSavedSecret: boolean;
  }> {
    const integration = await api.get(AssistantConstants.ENDPOINTS.INTEGRATION);
    const storedProviders = Array.isArray(integration?.storedProviders) ? integration.storedProviders : [];
    const activeProvider = String(integration?.active?.provider || '').trim().toLowerCase();
    const firstEnabled = storedProviders.find((item: any) => item && item.enabled !== false) || null;
    const provider = activeProvider || String(firstEnabled?.providerKey || '').trim().toLowerCase() || 'openai';
    const providerConfig =
      storedProviders.find((item: any) => String(item?.providerKey || '').trim().toLowerCase() === provider)?.config ||
      integration?.active?.config ||
      {};
    const providerNeedsApiKey = provider === 'openai' || provider === 'anthropic' || provider === 'gemini';

    return {
      provider,
      model: String(providerConfig?.model || '').trim(),
      baseUrl: String(providerConfig?.baseUrl || '').trim(),
      integrationConfigured: !!firstEnabled || !!integration?.active,
      hasSavedSecret: providerNeedsApiKey ? String(providerConfig?.apiKey || '').trim().length > 0 : true,
    };
  }

  static async fetchProviderModels(
    api: any,
    params: {
      provider: string;
      apiKey: string;
      baseUrl: string;
      hasSavedSecret: boolean;
      model: string;
    },
  ): Promise<{
    models: Array<{ value: string; label: string }>;
    error: string;
    nextModel: string;
  }> {
    const provider = String(params.provider || '').trim().toLowerCase();
    const apiKey = String(params.apiKey || '').trim();
    let baseUrl = String(params.baseUrl || '').trim();
    const hasSavedSecret = params.hasSavedSecret === true;
    const currentModel = String(params.model || '').trim();

    if ((provider === 'openai' || provider === 'anthropic' || provider === 'gemini') && !apiKey && !hasSavedSecret) {
      const providerLabel = provider === 'openai' ? 'OpenAI' : provider === 'anthropic' ? 'Anthropic' : 'Gemini';
      return { models: [], error: `Add a ${providerLabel} API key to load models.`, nextModel: currentModel };
    }

    if (provider === 'ollama' && /(^|:\/\/)(api\.)?openai\.com$/i.test(this.resolveHostname(baseUrl))) {
      baseUrl = '';
    }

    const baseUrlError = this.validateProviderBaseUrl(baseUrl);
    if (baseUrlError) {
      return { models: [], error: baseUrlError, nextModel: currentModel };
    }

    const config: Record<string, any> = {};
    if (provider === 'ollama') config.baseUrl = baseUrl;
    else if (baseUrl) config.baseUrl = baseUrl;
    if ((provider === 'openai' || provider === 'anthropic' || provider === 'gemini') && apiKey) {
      config.apiKey = apiKey;
    }

    try {
      const response = await api.post(AssistantConstants.ENDPOINTS.MODELS, { provider, config });
      const models = Array.isArray(response?.models)
        ? response.models
            .map((item: any) => ({
              value: String(item?.value || '').trim(),
              label: String(item?.label || item?.value || '').trim(),
            }))
            .filter((item: { value: string; label: string }) => !!item.value)
        : [];

      return {
        models,
        error: models.length === 0 ? 'No models returned by this provider.' : '',
        nextModel: this.resolvePreferredModel(provider, currentModel, models),
      };
    } catch (error: any) {
      const rawError = String(error?.message || 'Failed to fetch models.').trim();
      const normalizedError = rawError.toLowerCase();
      if (provider === 'ollama' && (normalizedError.includes('fetch failed') || normalizedError.includes('failed to fetch'))) {
        return {
          models: [],
          error: 'Could not reach Ollama. If API runs in Docker and Ollama runs on your host, set Base URL to http://host.docker.internal:11434.',
          nextModel: currentModel,
        };
      }
      return { models: [], error: rawError, nextModel: currentModel };
    }
  }

  static async fetchTools(api: any): Promise<AssistantToolOption[]> {
    const response = await api.get(AssistantConstants.ENDPOINTS.TOOLS);
    return Array.isArray(response?.tools)
      ? response.tools
          .map((entry: any) => ({
            tool: String(entry?.tool || '').trim(),
            description: entry?.description ? String(entry.description) : undefined,
            readOnly: entry?.readOnly === true,
          }))
          .filter((entry: AssistantToolOption) => !!entry.tool)
      : [];
  }

  static async fetchSkills(api: any): Promise<AssistantSkill[]> {
    const response = await api.get(AssistantConstants.ENDPOINTS.SKILLS);
    const skills = Array.isArray(response?.skills)
      ? response.skills
          .map((entry: any) => ({
            id: String(entry?.id || '').trim().toLowerCase(),
            label: String(entry?.label || entry?.id || '').trim(),
            description: entry?.description ? String(entry.description) : undefined,
            defaultMode: entry?.defaultMode ? String(entry.defaultMode).trim().toLowerCase() : undefined,
            riskPolicy: entry?.riskPolicy ? String(entry.riskPolicy).trim().toLowerCase() : undefined,
          }))
          .filter((entry: AssistantSkill) => !!entry.id)
      : [];

    return skills.some((entry) => entry.id === 'general')
      ? skills
      : [{ id: 'general', label: 'General' }, ...skills];
  }

  static resolveProviderSwitch(
    provider: string,
    browserState: { readProviderBaseUrl(providerKey: string): string },
  ): { provider: string; model: string; baseUrl: string } {
    const normalized = String(provider || '').trim().toLowerCase();
    let baseUrl = AdminAssistantPageUtils.sanitizeBaseUrlForProvider(normalized, browserState.readProviderBaseUrl(normalized));
    if (!baseUrl && normalized === 'ollama') baseUrl = AdminAssistantPageUtils.OLLAMA_DOCKER_BASE_URL;

    return {
      provider: normalized,
      model: AssistantConstants.PROVIDER_PRESETS[normalized]?.[0]?.value || '',
      baseUrl,
    };
  }

  static async saveIntegration(
    api: any,
    params: {
      provider: string;
      apiKey: string;
      model: string;
      baseUrl: string;
      hasSavedSecret: boolean;
    },
  ): Promise<{ hasSavedSecret: boolean }> {
    const provider = String(params.provider || '').trim().toLowerCase();
    const apiKey = String(params.apiKey || '').trim();
    const model = String(params.model || '').trim();
    let baseUrl = AdminAssistantPageUtils.sanitizeBaseUrlForProvider(provider, params.baseUrl);
    const providerNeedsApiKey = provider === 'openai' || provider === 'anthropic' || provider === 'gemini';
    if (provider === 'ollama' && !baseUrl) baseUrl = AdminAssistantPageUtils.OLLAMA_DOCKER_BASE_URL;
    if (providerNeedsApiKey && !apiKey && !params.hasSavedSecret) {
      throw new Error(`${provider.charAt(0).toUpperCase()}${provider.slice(1)} API key is required.`);
    }

    const config: Record<string, any> = {
      model: model || undefined,
      baseUrl: baseUrl || undefined,
    };
    if (providerNeedsApiKey && apiKey) config.apiKey = apiKey;

    await api.put(AssistantConstants.ENDPOINTS.INTEGRATION, {
      provider,
      config,
      enabled: true,
      makeActive: true,
    });

    return { hasSavedSecret: params.hasSavedSecret || Boolean(apiKey) };
  }

  static isTransientBootstrapError(error: any): boolean {
    const status = Number(error?.status || error?.data?.status || 0);
    const message = String(error?.message || '').trim().toLowerCase();
    return status === 429
      || status >= 500
      || message.includes('failed to fetch')
      || message.includes('fetch failed')
      || message.includes('networkerror')
      || message.includes('network error');
  }

  private static resolveHostname(baseUrl: string): string {
    try {
      return new URL(baseUrl).hostname || '';
    } catch {
      return '';
    }
  }

  private static resolvePreferredModel(
    provider: string,
    currentModel: string,
    models: Array<{ value: string; label: string }>,
  ): string {
    if (models.length === 0) {
      return currentModel;
    }

    if (!currentModel) {
      return models[0].value;
    }

    const exactMatch = models.find((item) => item.value === currentModel);
    if (exactMatch) {
      return exactMatch.value;
    }

    if (provider === 'ollama') {
      const normalizedCurrentModel = this.normalizeOllamaModel(currentModel);
      const aliasMatch = models.find((item) => this.normalizeOllamaModel(item.value) === normalizedCurrentModel);
      if (aliasMatch) {
        return aliasMatch.value;
      }
    }

    return models[0].value;
  }

  private static normalizeOllamaModel(model: string): string {
    return String(model || '').trim().replace(/:latest$/i, '');
  }

  private static validateProviderBaseUrl(baseUrl: string): string {
    if (!baseUrl) return '';
    try {
      const parsed = new URL(baseUrl);
      const currentHost =
        typeof window !== 'undefined' ? String(window.location.hostname || '').trim().toLowerCase() : '';
      const candidateHost = String(parsed.hostname || '').trim().toLowerCase();
      const candidatePath = String(parsed.pathname || '').trim().toLowerCase();
      const apiPrefix = ApiVersionUtils.prefix().toLowerCase();
      const apiBasePrefix = `${apiPrefix.split('/v')[0]}/`.toLowerCase();
      const pointsToForgeApi =
        candidatePath.includes('/forge/admin/assistant') ||
        candidatePath.startsWith(apiPrefix) ||
        candidatePath.startsWith(apiBasePrefix);
      if (pointsToForgeApi && (!currentHost || candidateHost === currentHost)) {
        return `Base URL points to this app API (${baseUrl}). Set the provider endpoint instead (for example Ollama: http://host.docker.internal:11434).`;
      }
      return '';
    } catch {
      return 'Base URL must be a full URL (for example: http://host.docker.internal:11434).';
    }
  }
}
