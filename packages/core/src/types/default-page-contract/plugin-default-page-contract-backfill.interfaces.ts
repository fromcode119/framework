import type { ResolvedPluginDefaultPageContract } from './plugin-default-page-contract-resolution.interfaces';
import type { PluginDefaultPageContractMaterializationMode } from './plugin-default-page-contract.types';
import type {
  PluginDefaultPageContractBackfillAction,
  PluginDefaultPageContractBackfillMatchSource,
  PluginDefaultPageContractBackfillStatus,
} from './plugin-default-page-contract-backfill.types';

export interface PluginDefaultPageContractBackfillPageSnapshot {
  id: number | string;
  slug?: string;
  customPermalink?: string;
  title?: string;
  status?: string;
}

export interface PluginDefaultPageContractBackfillAssociationSnapshotEntry {
  canonicalKey?: string;
  pageId?: number | string;
}

export interface PluginDefaultPageContractBackfillAssociationSnapshot {
  byCanonicalKey?: Record<string, PluginDefaultPageContractBackfillAssociationSnapshotEntry>;
  byPageId?: Record<string, PluginDefaultPageContractBackfillAssociationSnapshotEntry>;
}

export interface PluginDefaultPageContractBackfillPlanInput {
  resolvedContracts: ResolvedPluginDefaultPageContract[];
  existingPages: PluginDefaultPageContractBackfillPageSnapshot[];
  existingAssociations: PluginDefaultPageContractBackfillAssociationSnapshot;
}

export interface PluginDefaultPageContractBackfillPlanEntry {
  canonicalKey: string;
  namespace: string;
  pluginSlug: string;
  key: string;
  action: PluginDefaultPageContractBackfillAction;
  status: PluginDefaultPageContractBackfillStatus;
  matchedPageId?: number | string;
  existingAssociationPageId?: number | string;
  lookupCandidates: string[];
  reasons: string[];
  materializationMode: PluginDefaultPageContractMaterializationMode;
}

export interface PluginDefaultPageContractBackfillPlanSummary {
  total: number;
  byAction: Record<PluginDefaultPageContractBackfillAction, number>;
  byStatus: Record<PluginDefaultPageContractBackfillStatus, number>;
}

export interface PluginDefaultPageContractBackfillPlan {
  entries: PluginDefaultPageContractBackfillPlanEntry[];
  summary: PluginDefaultPageContractBackfillPlanSummary;
}

export interface PluginDefaultPageContractBackfillCandidatePage extends PluginDefaultPageContractBackfillPageSnapshot {
  customPermalinkCandidates: string[];
  slugCandidates: string[];
}

export interface PluginDefaultPageContractBackfillPageMatch {
  matchedPageId: number | string;
  priority: number;
  source: PluginDefaultPageContractBackfillMatchSource;
}

export interface PluginDefaultPageContractBackfillAssociationRecord {
  canonicalKey: string;
  pageId: number | string;
}

export interface PluginDefaultPageContractBackfillAssociationConflicts {
  canonicalKeys: Set<string>;
  pageIds: Set<string>;
}

export interface PluginDefaultPageContractBackfillAssociationMaps {
  byCanonicalKey: Map<string, PluginDefaultPageContractBackfillAssociationRecord>;
  byPageId: Map<string, PluginDefaultPageContractBackfillAssociationRecord>;
  conflicts: PluginDefaultPageContractBackfillAssociationConflicts;
}