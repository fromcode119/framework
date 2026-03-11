import type { McpToolDefinition } from '@fromcode119/mcp';
import type { AdminAssistantRuntimeOptions } from '../types';
import { SearchTextHelpers } from './search-text-helpers';
import { RuntimeMiscHelpers } from './runtime-misc-helpers';
import { ActionSafetyHelpers } from './action-safety-helpers';

/** MCP tool definitions for settings, plugins, themes, web and system operations. */
export class McpMiscTools {
  static build(options: AdminAssistantRuntimeOptions, dryRun: boolean): McpToolDefinition[] {
    const nowFn = options.now || (() => new Date().toISOString());
    return [
      {
        tool: 'settings.get', readOnly: true,
        description: 'Get value of a system meta setting key.',
        handler: async (input) => {
          const key = String(input?.key || '').trim();
          if (!key) throw new Error('Missing setting key');
          const existing = await options.getSetting(key);
          return { key, value: existing?.value ?? null, found: !!existing?.found };
        },
      },
      {
        tool: 'settings.set', readOnly: false,
        description: 'Update value of a system meta setting key.',
        handler: async (input, context) => {
          const key = String(input?.key || '').trim();
          const value = String(input?.value ?? '').trim();
          if (!key) throw new Error('Missing setting key');
          const existing = await options.getSetting(key);
          const keyValidationError = ActionSafetyHelpers.validateWritableSettingKey(key, existing);
          if (keyValidationError) throw new Error(keyValidationError);
          const group = String(existing?.group || 'ai-assistant').trim() || 'ai-assistant';
          const effectiveDryRun = context?.dryRun === true || dryRun;
          if (effectiveDryRun) return { dryRun: true, action: { type: 'update_setting', key, value } };
          await options.upsertSetting(key, value, group);
          return { dryRun: false, action: { type: 'update_setting', key, value } };
        },
      },
      {
        tool: 'plugins.list', readOnly: true,
        description: 'List installed plugins and their activation state.',
        handler: async () => {
          const plugins = typeof options.getPlugins === 'function' ? options.getPlugins() : [];
          return { plugins: plugins.map((p) => ({ slug: p.slug, name: p.name, version: p.version, state: p.state, capabilities: Array.isArray(p.capabilities) ? p.capabilities : [] })) };
        },
      },
      {
        tool: 'themes.list', readOnly: true,
        description: 'List installed themes and their activation state.',
        handler: async () => {
          const themes = typeof options.getThemes === 'function' ? options.getThemes() : [];
          return { themes: themes.map((t) => ({ slug: t.slug, name: t.name, version: t.version, state: t.state })) };
        },
      },
      {
        tool: 'web.search', readOnly: true,
        description: 'Search the web for current information.',
        handler: async (input) => {
          const query = String(input?.query || input?.q || '').trim();
          if (!query) throw new Error('Missing search query');
          const maxResults = Math.min(10, Math.max(1, Number(input?.limit || 5)));
          const endpoint = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_redirect=1&no_html=1`;
          const response = await fetch(endpoint, { headers: { Accept: 'application/json' } });
          if (!response.ok) throw new Error(`web.search failed (${response.status})`);
          const payload = await response.json().catch(() => ({} as any));
          const seen = new Set<string>();
          const items: Array<{ title: string; url: string; snippet: string }> = [];
          const pushItem = (titleRaw: any, urlRaw: any, snippetRaw: any) => {
            const title = String(titleRaw || '').trim(); const url = String(urlRaw || '').trim(); const snippet = String(snippetRaw || '').trim();
            if (!url || seen.has(url)) return;
            seen.add(url); items.push({ title: title || url, url, snippet });
          };
          pushItem(payload?.Heading, payload?.AbstractURL, payload?.AbstractText);
          const walkTopics = (topics: any[]) => {
            if (!Array.isArray(topics)) return;
            for (const topic of topics) {
              if (items.length >= maxResults) return;
              if (!topic || typeof topic !== 'object') continue;
              if (Array.isArray((topic as any).Topics)) { walkTopics((topic as any).Topics); continue; }
              pushItem((topic as any).Text, (topic as any).FirstURL, (topic as any).Text);
            }
          };
          walkTopics(Array.isArray(payload?.RelatedTopics) ? payload.RelatedTopics : []);
          return { query, results: items.slice(0, maxResults), source: 'duckduckgo' };
        },
      },
      {
        tool: 'web.fetch', readOnly: true,
        description: 'Fetch and summarize a page by URL (HTML, JSON, or plain text).',
        handler: async (input) => {
          const parsedUrl = SearchTextHelpers.normalizeWebUrl(String(input?.url || input?.href || ''));
          const timeoutMs = Math.min(20_000, Math.max(2_000, Number(input?.timeoutMs || 10_000)));
          const maxChars = Math.min(16_000, Math.max(400, Number(input?.maxChars || 4_000)));
          const maxLinks = Math.min(20, Math.max(0, Number(input?.maxLinks || 8)));
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), timeoutMs);
          let response: Response;
          try {
            response = await fetch(parsedUrl.toString(), { signal: controller.signal, headers: { Accept: 'text/html,application/json,text/plain;q=0.9,*/*;q=0.5' } });
          } catch (error: any) {
            if (error?.name === 'AbortError') throw new Error(`web.fetch timed out after ${timeoutMs}ms`);
            throw new Error(`web.fetch failed: ${String(error?.message || 'Request error')}`);
          } finally { clearTimeout(timer); }
          const contentType = String(response.headers.get('content-type') || '').toLowerCase();
          const rawBody = await response.text().catch(() => '');
          const finalUrl = String(response.url || parsedUrl.toString());
          const status = Number(response.status || 0);
          const isHtml = contentType.includes('text/html');
          const isJson = contentType.includes('application/json');
          let title: string | undefined; let extractedText = ''; let links: string[] = [];
          if (isJson) { try { extractedText = JSON.stringify(JSON.parse(rawBody), null, 2); } catch { extractedText = rawBody; } }
          else if (isHtml) { title = SearchTextHelpers.extractHtmlTitle(rawBody); extractedText = SearchTextHelpers.htmlToPlainText(rawBody); links = SearchTextHelpers.extractHtmlLinks(rawBody, finalUrl, maxLinks); }
          else { extractedText = rawBody; }
          const normalizedText = String(extractedText || '').replace(/\s+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
          const truncated = normalizedText.length > maxChars;
          const text = truncated ? `${normalizedText.slice(0, maxChars)}...` : normalizedText;
          return { url: finalUrl, requestedUrl: parsedUrl.toString(), status, ok: response.ok, contentType: contentType || null, title: title || null, text, truncated, links, fetchedAt: nowFn() };
        },
      },
      {
        tool: 'system.now', readOnly: true,
        description: 'Get current server timestamp.',
        handler: async () => ({ now: nowFn() }),
      },
    ];
  }
}
