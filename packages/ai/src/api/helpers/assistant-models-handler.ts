import { Request, Response } from 'express';
import type { ControllerDeps } from './controller-deps';

/** Handles the assistantModels endpoint logic. */
export class AssistantModelsHandler {
  static async handle(req: Request, res: Response, deps: ControllerDeps): Promise<Response> {
    const startedAt = Date.now();
    try {
      const provider = String(req.body?.provider || req.query?.provider || '').trim().toLowerCase() || 'openai';
      const requestConfig = req.body?.config && typeof req.body.config === 'object' ? req.body.config : {};
      const storedConfig = await deps.getStoredAiProviderConfig(provider);
      const mergedConfig = { ...storedConfig, ...requestConfig };
      const formatError = (baseUrl: string, response: any, payload: any): string => {
        const raw = String(payload?.error?.message || payload?.error || payload?.message || response.statusText || '').trim();
        if (response.status === 404 || raw.toLowerCase() === 'not found') return `Provider endpoint not found at "${baseUrl}". Check the ${provider} Base URL in Forge settings.`;
        return raw || 'Failed to fetch models';
      };

      if (provider === 'openai') {
        const apiKey = String(mergedConfig?.apiKey || '').trim();
        if (!apiKey) return res.status(400).json({ error: 'OpenAI API key is required to fetch models.' });
        const baseUrl = deps.trimTrailingSlash(String(mergedConfig?.baseUrl || process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1').trim()) || 'https://api.openai.com/v1';
        const response = await fetch(`${baseUrl}/models`, { method: 'GET', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}`, ...(mergedConfig?.organization ? { 'OpenAI-Organization': String(mergedConfig.organization) } : {}), ...(mergedConfig?.project ? { 'OpenAI-Project': String(mergedConfig.project) } : {}) } });
        const payload = await response.json().catch(() => ({} as any));
        if (!response.ok) return res.status(400).json({ error: formatError(baseUrl, response, payload) });
        const models = Array.isArray(payload?.data) ? payload.data.map((item: any) => String(item?.id || '').trim()).filter((item: string) => !!item).sort((a: string, b: string) => a.localeCompare(b)) : [];
        await deps.emitAssistantTelemetry('models.list', { provider, count: models.length, durationMs: Date.now() - startedAt });
        return res.json({ provider, models: models.map((id: string) => ({ value: id, label: id })) });
      }

      if (provider === 'ollama') {
        const configuredBaseUrlRaw = deps.trimTrailingSlash(String(mergedConfig?.baseUrl || process.env.OLLAMA_BASE_URL || '').trim());
        const defaultCandidates = ['http://127.0.0.1:11434', 'http://host.docker.internal:11434'];
        const configuredHost = (() => { if (!configuredBaseUrlRaw) return ''; try { return String(new URL(configuredBaseUrlRaw).hostname || '').trim().toLowerCase(); } catch { return ''; } })();
        const configuredLooksWrong = configuredHost.includes('openai.com') || configuredHost.includes('anthropic.com') || configuredHost.includes('googleapis.com');
        const configuredBaseUrl = configuredBaseUrlRaw && !configuredLooksWrong ? configuredBaseUrlRaw : '';
        const includeFallback = !configuredBaseUrl || configuredHost === '127.0.0.1' || configuredHost === 'localhost' || configuredHost === '0.0.0.0';
        const baseCandidates = Array.from(new Set([...(configuredBaseUrl ? [configuredBaseUrl] : []), ...(includeFallback ? defaultCandidates : [])].map((item) => deps.trimTrailingSlash(String(item || '').trim())).filter(Boolean)));
        let resolvedBaseUrl = ''; let lastMessage = ''; let models: string[] = []; let success = false;
        for (const candidate of baseCandidates) {
          const baseUrl = deps.trimTrailingSlash(String(candidate || '').trim());
          if (!baseUrl) continue;
          resolvedBaseUrl = baseUrl;
          try {
            const response = await fetch(`${baseUrl}/api/tags`, { method: 'GET' });
            const payload = await response.json().catch(() => ({} as any));
            if (response.ok) { models = Array.isArray(payload?.models) ? payload.models.map((item: any) => String(item?.model || item?.name || '').trim()).filter((item: string) => !!item).sort((a: string, b: string) => a.localeCompare(b)) : []; success = true; break; }
            lastMessage = formatError(baseUrl, response, payload);
          } catch (error: any) { lastMessage = String(error?.message || `Failed to reach Ollama at "${baseUrl}"`).trim(); }
        }
        if (!success) {
          const triedList = baseCandidates.join(', ');
          const fallbackHint = configuredBaseUrl && !includeFallback ? `Tried ${triedList}.` : `Tried ${triedList || 'http://127.0.0.1:11434, http://host.docker.internal:11434'}.`;
          const dockerHint = 'If API runs in Docker and Ollama runs on host, use http://host.docker.internal:11434 as Ollama Base URL.';
          return res.status(400).json({ error: `${lastMessage || 'Failed to fetch models'}. ${fallbackHint} ${dockerHint}` });
        }
        await deps.emitAssistantTelemetry('models.list', { provider, count: models.length, baseUrl: resolvedBaseUrl, durationMs: Date.now() - startedAt });
        return res.json({ provider, models: models.map((id: string) => ({ value: id, label: id })) });
      }

      if (provider === 'anthropic') {
        const apiKey = String(mergedConfig?.apiKey || '').trim();
        if (!apiKey) return res.status(400).json({ error: 'Anthropic API key is required to fetch models.' });
        const baseUrl = deps.trimTrailingSlash(String(mergedConfig?.baseUrl || process.env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com').trim()) || 'https://api.anthropic.com';
        const anthropicVersion = String(mergedConfig?.anthropicVersion || process.env.ANTHROPIC_VERSION || '2023-06-01').trim() || '2023-06-01';
        const response = await fetch(`${baseUrl}/v1/models`, { method: 'GET', headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': anthropicVersion } });
        const payload = await response.json().catch(() => ({} as any));
        if (!response.ok) return res.status(400).json({ error: formatError(baseUrl, response, payload) });
        const models = Array.isArray(payload?.data) ? payload.data.map((item: any) => String(item?.id || '').trim()).filter((item: string) => !!item).sort((a: string, b: string) => a.localeCompare(b)) : [];
        await deps.emitAssistantTelemetry('models.list', { provider, count: models.length, durationMs: Date.now() - startedAt });
        return res.json({ provider, models: models.map((id: string) => ({ value: id, label: id })) });
      }

      if (provider === 'gemini') {
        const apiKey = String(mergedConfig?.apiKey || mergedConfig?.googleApiKey || '').trim();
        if (!apiKey) return res.status(400).json({ error: 'Gemini API key is required to fetch models.' });
        const baseUrl = deps.trimTrailingSlash(String(mergedConfig?.baseUrl || process.env.GEMINI_BASE_URL || 'https://generativelanguage.googleapis.com/v1beta').trim()) || 'https://generativelanguage.googleapis.com/v1beta';
        const response = await fetch(`${baseUrl}/models?key=${encodeURIComponent(apiKey)}`, { method: 'GET', headers: { 'Content-Type': 'application/json' } });
        const payload = await response.json().catch(() => ({} as any));
        if (!response.ok) return res.status(400).json({ error: formatError(baseUrl, response, payload) });
        const models = Array.isArray(payload?.models) ? payload.models.map((item: any) => String(item?.name || '').replace(/^models\//i, '').trim()).filter((item: string) => !!item).sort((a: string, b: string) => a.localeCompare(b)) : [];
        await deps.emitAssistantTelemetry('models.list', { provider, count: models.length, durationMs: Date.now() - startedAt });
        return res.json({ provider, models: models.map((id: string) => ({ value: id, label: id })) });
      }

      await deps.emitAssistantTelemetry('models.list.failed', { provider, error: `Unsupported provider "${provider}"`, durationMs: Date.now() - startedAt });
      return res.status(400).json({ error: `Unsupported provider "${provider}"` });
    } catch (e: any) {
      await deps.emitAssistantTelemetry('models.list.failed', { provider: String(req.body?.provider || req.query?.provider || '').trim().toLowerCase() || 'openai', error: String(e?.message || 'Failed to fetch provider models'), durationMs: Date.now() - startedAt });
      return res.status(500).json({ error: e?.message || 'Failed to fetch provider models' });
    }
  }
}
