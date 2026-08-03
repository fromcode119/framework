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
}
