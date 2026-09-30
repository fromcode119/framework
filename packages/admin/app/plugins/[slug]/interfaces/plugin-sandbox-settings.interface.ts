

/** A plugin's own limits. Where it runs is not a setting: every plugin runs in its own process. */
export interface IPluginSandboxSettings {
  /** `null` when the operator has not set one — the platform default applies, shown as a placeholder. */
  memoryLimit: number | null;
  /** `null` when the operator has not set one — the platform default applies, shown as a placeholder. */
  timeout: number | null;
}
