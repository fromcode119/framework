import type { PluginApiResolver } from './plugin-api-resolver.interfaces';

export class PluginsRegistry implements PluginApiResolver {
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

  private static createKey(namespace: string, slug: string): string {
    const normalizedNamespace = String(namespace || '').trim().toLowerCase();
    const normalizedSlug = String(slug || '').trim().toLowerCase();
    return `${normalizedNamespace}:${normalizedSlug}`;
  }
}
