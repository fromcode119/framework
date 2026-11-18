/** Whether a plugin's declared core requirement is met, and by what. */
export interface IPluginCoreCompatibility {
  /** True when the plugin may run on `running` — including when it declares no requirement. */
  ok: boolean;
  /** The declared semver RANGE for the core, or null when the manifest declares none. */
  required: string | null;
  /** The core version this installation runs, as read. */
  running: string;
}
