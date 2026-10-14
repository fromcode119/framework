import type { IPluginApiResolver } from '@core/plugin/interfaces/plugin-api-resolver.interface';

export class PluginsRegistry implements IPluginApiResolver {
  private readonly entries = new Map<string, unknown>();

  register(namespace: string, slug: string, api: unknown): void {
    this.entries.set(PluginsRegistry.createKey(namespace, slug), api);
  }

  has(namespace: string, slug: string): boolean {
    return this.entries.has(PluginsRegistry.createKey(namespace, slug));
  }

  resolve(namespace: string, slug: string): unknown {
    return this.entries.get(PluginsRegistry.createKey(namespace, slug));
  }

  slugs(namespace: string): string[] {
    const prefix = `${String(namespace || '').trim().toLowerCase()}:`;
    return [...this.entries.keys()].filter((key) => key.startsWith(prefix)).map((key) => key.slice(prefix.length));
  }

  private static createKey(namespace: string, slug: string): string {
    const normalizedNamespace = String(namespace || '').trim().toLowerCase();
    const normalizedSlug = String(slug || '').trim().toLowerCase();
    return `${normalizedNamespace}:${normalizedSlug}`;
  }
}
