/**
 * What happened to an isolated plugin's PROCESS after its sandbox config was saved.
 *
 * `restartRequired` alone means the setting is saved but has not taken effect anywhere yet — the
 * plugin kept running exactly as before, on the OLD isolation mode, until the api restarts.
 * `restartFailed` means something stronger and worse: an in-place reload was attempted (the plugin
 * was already isolated and stays isolated) and the new process could not come up, so the plugin's
 * guest may be DOWN right now even though the save itself succeeded.
 */
export interface ISandboxHostReloadResult {
  /** True when the new sandbox settings are not in effect yet and an API restart is what applies them. */
  restartRequired: boolean;
  /** True only when a live reload was attempted and the replacement process failed to boot. */
  restartFailed?: boolean;
  /** The reload failure's message, present only when `restartFailed` is true. */
  reason?: string;
}
