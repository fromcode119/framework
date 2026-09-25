import { PluginHealthBucket } from '@fromcode119/core/client';

export interface IPluginHealthEntry {
  slug: string;
  state: string;
  healthStatus?: string;
  heldReason?: string;
  error?: string;
  manifestCapabilities?: string[];
  approvedCapabilities?: string[];
  addedCapabilities: string[];
  removedCapabilities: string[];
  bucket: PluginHealthBucket;
  /** The version this api process loaded, and the one installed on disk now. */
  runningVersion?: string;
  installedVersion?: string | null;
  /** Installed differs from running: the screen is serving an older (or newer) build than installed. */
  restartPending: boolean;
}
