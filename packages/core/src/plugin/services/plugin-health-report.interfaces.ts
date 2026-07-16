import { PluginHealthBucket } from './plugin-health.enums';
export interface PluginHealthEntryInput {
  slug: string;
  state: string;
  healthStatus?: string;
  heldReason?: string;
  error?: string;
  manifestCapabilities?: string[];
  approvedCapabilities?: string[];
}

export interface PluginHealthEntry extends PluginHealthEntryInput {
  addedCapabilities: string[];
  removedCapabilities: string[];
  bucket: PluginHealthBucket;
}

export interface PluginHealthReport {
  ok: boolean;
  counts: { total: number; active: number; held: number; error: number; inactive: number };
  held: PluginHealthEntry[];
  error: PluginHealthEntry[];
  entries: PluginHealthEntry[];
}
