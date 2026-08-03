import type { NamespacedPluginsFacade } from '@core/namespaced-plugins-facade';

/**
 * The `context.plugins` surface of {@link PluginContext}.
 *
 * Extracted from an anonymous inline object type: a plugin-facing CONTRACT deserves a name it can be
 * referenced by, and 25 of these inline in one class put the file at 366 lines.
 */
export interface IPluginContextPlugins {
  namespace(namespace: string): NamespacedPluginsFacade;
  has(namespace: string, slug: string): boolean;
  get(namespace: string, slug: string): any;
  require<TPlugin = any>(key: string): TPlugin;
  optional<TPlugin = any>(key: string): TPlugin | null;
  isEnabled(slug: string): boolean;
  emit(event: string, payload: any): void;
  on(event: string, handler: (payload: any) => void | Promise<void>): void;
}
