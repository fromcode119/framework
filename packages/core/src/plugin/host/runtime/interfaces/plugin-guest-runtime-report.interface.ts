import type { IPluginGuestRegistration } from '@core/plugin/host/interfaces/plugin-guest-registration.interface';

/** What a plugin process says about itself when asked: measured inside it, not guessed by the api. */
export interface IPluginGuestRuntimeReport {
  pid: number;
  uptimeSeconds: number;
  nodeVersion: string;
  memory: { rssBytes: number; heapUsedBytes: number; heapTotalBytes: number };
  /** Everything it registered and has not withdrawn, oldest first. */
  registrations: IPluginGuestRegistration[];
}
