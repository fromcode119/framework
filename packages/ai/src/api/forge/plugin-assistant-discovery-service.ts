import { PluginManager } from '@fromcode119/core';
import type { McpToolDefinition } from '@fromcode119/mcp';
import { AssistantCatalogService } from './catalog-service';
import { PluginPublicApiResolver } from './plugin-public-api-resolver';

export class PluginAssistantDiscoveryService {
  private readonly apiResolver: PluginPublicApiResolver;

  constructor(
    private readonly manager: PluginManager,
    private readonly catalog: AssistantCatalogService,
  ) {
    this.apiResolver = new PluginPublicApiResolver(manager);
  }

  buildTools(): McpToolDefinition[] {
    const tools: McpToolDefinition[] = [];

    for (const plugin of this.apiResolver.listInstalledPlugins()) {
      tools.push(this.createPluginInfoTool(plugin));
    }

    for (const plugin of this.apiResolver.listActivePlugins()) {
      const publicApi = this.apiResolver.resolvePublicApi(plugin);
      const methodNames = this.apiResolver.listMethodNames(publicApi)
        .filter((methodName) => this.isAutoExposedReadOnlyMethod(methodName));

      for (const methodName of methodNames) {
        const tool = this.createPluginMethodTool(plugin, publicApi, methodName);
        if (tool) {
          tools.push(tool);
        }
      }
    }

    return tools;
  }

  buildPromptLines(): string[] {
    const pluginSummaries = this.apiResolver.listActivePlugins()
      .map((plugin) => this.buildPluginPromptSummary(plugin))
      .filter(Boolean);

    const lines = [
      'Plugin visibility is auto-discovered from active plugins. Use plugins.api.<slug>.info to inspect any plugin before deciding which plugin tool to call.',
    ];

    if (pluginSummaries.length > 0) {
      lines.push(`Auto-discovered read-only plugin APIs: ${pluginSummaries.join('; ')}.`);
    } else {
      lines.push('No active plugins currently expose read-only public API methods, but plugin info tools are still available for installed active plugins.');
    }

    return lines;
  }

  private buildPluginPromptSummary(plugin: any): string {
    const publicApi = this.apiResolver.resolvePublicApi(plugin);
    const methodNames = this.apiResolver.listMethodNames(publicApi)
      .filter((methodName) => this.isAutoExposedReadOnlyMethod(methodName));

    if (methodNames.length === 0) {
      return '';
    }

    const slug = String(plugin?.manifest?.slug || '').trim();
    return `${slug} (${methodNames.slice(0, 5).join(', ')})`;
  }

  private createPluginInfoTool(plugin: any): McpToolDefinition {
    const slug = String(plugin?.manifest?.slug || '').trim();

    return {
      tool: `plugins.api.${slug}.info`,
      readOnly: true,
      description: `Inspect plugin metadata, collections, and discovered public API methods for ${slug}.`,
      handler: async () => this.buildPluginInfo(plugin),
    };
  }

  private createPluginMethodTool(
    plugin: any,
    publicApi: unknown,
    methodName: string,
  ): McpToolDefinition | null {
    const method = publicApi && (publicApi as any)[methodName];
    if (typeof method !== 'function') {
      return null;
    }

    const slug = String(plugin?.manifest?.slug || '').trim();
    const toolName = `plugins.api.${slug}.${this.toToolSegment(methodName)}`;

    return {
      tool: toolName,
      readOnly: true,
      description: `Call read-only plugin API method ${methodName} on ${slug}.`,
      handler: async (input?: Record<string, any>) => {
        const output = await method.call(publicApi, input || {});
        return {
          plugin: slug,
          method: methodName,
          output,
        };
      },
    };
  }

  private async buildPluginInfo(plugin: any): Promise<Record<string, any>> {
    const slug = String(plugin?.manifest?.slug || '').trim();
    const publicApi = this.apiResolver.resolvePublicApi(plugin);
    const methods = this.apiResolver.listMethodNames(publicApi);
    const autoExposedMethods = methods.filter((methodName) =>
      this.isAutoExposedReadOnlyMethod(methodName),
    );
    const collections = this.catalog.getCollectionsContext()
      .filter((collection) => String(collection?.pluginSlug || '').trim() === slug)
      .map((collection) => ({
        slug: String(collection?.slug || '').trim(),
        shortSlug: String(collection?.shortSlug || '').trim(),
        label: String(collection?.label || '').trim(),
      }));

    return {
      slug,
      name: String(plugin?.manifest?.name || slug).trim(),
      namespace: String(plugin?.manifest?.namespace || '').trim() || null,
      version: String(plugin?.manifest?.version || '').trim() || null,
      state: String(plugin?.state || 'unknown').trim(),
      description: String(plugin?.manifest?.description || '').trim() || null,
      capabilities: Array.isArray(plugin?.manifest?.capabilities) ? plugin.manifest.capabilities : [],
      collections,
      publicApiMethods: methods,
      autoExposedMethods,
    };
  }

  private isAutoExposedReadOnlyMethod(methodName: string): boolean {
    const normalized = String(methodName || '').trim();
    if (!normalized) {
      return false;
    }

    const blockedPrefixes = [
      'apply',
      'adjust',
      'create',
      'credit',
      'debit',
      'delete',
      'disable',
      'enable',
      'ensure',
      'insert',
      'install',
      'post',
      'patch',
      'put',
      'record',
      'register',
      'remove',
      'save',
      'set',
      'sync',
      'topup',
      'uninstall',
      'update',
      'upsert',
      'write',
    ];
    if (blockedPrefixes.some((prefix) => normalized.startsWith(prefix))) {
      return false;
    }

    const allowedPrefixes = [
      'compute',
      'convert',
      'estimate',
      'find',
      'format',
      'get',
      'list',
      'load',
      'lookup',
      'preview',
      'resolve',
      'search',
    ];
    if (allowedPrefixes.some((prefix) => normalized.startsWith(prefix))) {
      return true;
    }

    return [
      'capabilities',
      'overview',
      'settings',
      'stats',
      'status',
      'summary',
    ].includes(normalized);
  }

  private toToolSegment(value: string): string {
    return String(value || '')
      .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
      .replace(/[^a-zA-Z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .toLowerCase();
  }
}
