import type { IPluginRuntimeRegistration } from '@/app/plugins/[slug]/interfaces/plugin-runtime-registration.interface';

/** GET /plugins/:slug/runtime — the plugin's process as the api sees it, and what the process reports. */
export interface IPluginRuntimeResponse {
  slug: string;
  /** False: the plugin runs inside the api process and has no process of its own. */
  isolated: boolean;
  runtime: {
    hostedBy: string;
    running: boolean;
    pid: number | null;
    uid: number | null;
    limits: { memoryMb: number; timeoutMs: number };
    recentRestarts: number;
    report: {
      pid: number;
      uptimeSeconds: number;
      nodeVersion: string;
      protocolVersion: number;
      memory: { rssBytes: number; heapUsedBytes: number; heapTotalBytes: number };
      registrations: IPluginRuntimeRegistration[];
    } | null;
    reportError: string | null;
  } | null;
}
