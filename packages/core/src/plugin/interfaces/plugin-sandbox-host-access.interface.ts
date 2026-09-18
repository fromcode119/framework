/** What `PluginHostRegistry` needs to expose for a sandbox save to react to — narrow on purpose so this stays testable without a real registry. */
export interface IPluginSandboxHostAccess {
  get(slug: string): unknown | null;
  isIsolated(sandbox: unknown): Promise<boolean>;
  reload(slug: string, manifest: Record<string, unknown>): Promise<boolean>;
  stop(slug: string): Promise<void>;
}
