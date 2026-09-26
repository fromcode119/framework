import type { IPluginGuestRuntimeReport } from '@core/plugin/host/runtime/interfaces/plugin-guest-runtime-report.interface';

/** One isolated plugin's process as the api sees it, plus what the process reported about itself. */
export interface IPluginHostRuntime {
  slug: string;
  /** A `PluginProcessHost` value. */
  hostedBy: string;
  running: boolean;
  pid: number | null;
  /** The OS user it runs as; null when it shares the api's user (no privileged spawner, e.g. local dev). */
  uid: number | null;
  limits: { memoryMb: number; timeoutMs: number };
  /** Restarts since it was last healthy for a minute — the count its restart budget is measured on. */
  recentRestarts: number;
  report: IPluginGuestRuntimeReport | null;
  /** Why `report` is null when the process is running but did not answer. */
  reportError: string | null;
}
