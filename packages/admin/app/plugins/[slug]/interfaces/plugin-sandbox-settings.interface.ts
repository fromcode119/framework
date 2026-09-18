

export interface IPluginSandboxSettings {
  enabled: boolean;
  /** `null` when the operator has not set one — the platform default applies, shown as a placeholder. */
  memoryLimit: number | null;
  /** `null` when the operator has not set one — the platform default applies, shown as a placeholder. */
  timeout: number | null;
  allowNative: boolean;
}
