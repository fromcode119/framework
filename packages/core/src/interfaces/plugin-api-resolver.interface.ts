export interface IPluginApiResolver {
  has(namespace: string, slug: string): boolean;
  resolve(namespace: string, slug: string): unknown;
}
