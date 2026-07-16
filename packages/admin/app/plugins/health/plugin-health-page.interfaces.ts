import { PluginHealthBucket } from '@fromcode119/core/client';

export interface PluginHealthEntry {
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

export interface PluginHealthCounts {
  total: number;
  active: number;
  held: number;
  error: number;
  inactive: number;
}

export interface PluginReapprovalEntry {
  slug: string;
  ok: boolean;
  error?: string;
}

export interface PluginHealthReport {
  ok: boolean;
  counts: PluginHealthCounts;
  held: PluginHealthEntry[];
  error: PluginHealthEntry[];
  entries: PluginHealthEntry[];
}

export interface PluginHealthViewProps {
  loading: boolean;
  report: PluginHealthReport | null;
  isBusy: boolean;
  busySlug: string | null;
  onApproveEnable: (slug: string) => Promise<void>;
  onReapproveAll: () => Promise<void>;
  theme: string;
}

export interface PluginHealthPageClientState {
  loading: boolean;
  report: PluginHealthReport | null;
  isBusy: boolean;
  busySlug: string | null;
}
