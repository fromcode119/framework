export interface PluginApiResolver {
  has(namespace: string, slug: string): boolean;
  resolve(namespace: string, slug: string): unknown;
}
