import type { ResolvedPluginDefaultPageContract } from './plugin-default-page-contract-resolution.interfaces';
import type { PluginDefaultPageContractBackfillAssociationSnapshot } from './plugin-default-page-contract-backfill.interfaces';
import type { PluginDefaultPageContractMaterializationMode } from './plugin-default-page-contract.types';
import type {
  PluginDefaultPageContractAssociationPersistStatus,
  PluginDefaultPageContractMaterializationAction,
  PluginDefaultPageContractMaterializationExecutionOutcome,
  PluginDefaultPageContractMaterializationPageMatchSource,
  PluginDefaultPageContractMaterializationStatus,
} from './plugin-default-page-contract-materialization.types';

export interface PluginDefaultPageContractPageSnapshot {
  id: number | string;
  slug?: string;
  customPermalink?: string;
  title?: string;
  status?: string;
}

export interface PluginDefaultPageContractMaterializationPlanInput {
  resolvedContracts: ResolvedPluginDefaultPageContract[];
  existingPages: PluginDefaultPageContractPageSnapshot[];
}

export interface PluginDefaultPageContractCreatePayload {
  canonicalKey: string;
  namespace: string;
  pluginSlug: string;
  key: string;
  slug: string;
  customPermalink: string;
  aliases: string[];
  recipe: string;
  title?: string;
  themeLayout?: string;
}

export interface PluginDefaultPageContractMaterializationPlanEntry {
  canonicalKey: string;
  namespace: string;
  pluginSlug: string;
  key: string;
  action: PluginDefaultPageContractMaterializationAction;
  lookupCandidates: string[];
  matchedPageId?: number | string;
  createPayload?: PluginDefaultPageContractCreatePayload;
  reasons: string[];
  materializationMode: PluginDefaultPageContractMaterializationMode;
  status: PluginDefaultPageContractMaterializationStatus;
}

export interface PluginDefaultPageContractMaterializationPlanSummary {
  total: number;
  byAction: Record<PluginDefaultPageContractMaterializationAction, number>;
  byStatus: Record<PluginDefaultPageContractMaterializationStatus, number>;
}

export interface PluginDefaultPageContractMaterializationPlan {
  entries: PluginDefaultPageContractMaterializationPlanEntry[];
  summary: PluginDefaultPageContractMaterializationPlanSummary;
}

export interface PluginDefaultPageContractMaterializationCandidatePage extends PluginDefaultPageContractPageSnapshot {
  customPermalinkCandidates: string[];
  slugCandidates: string[];
}

export interface PluginDefaultPageContractMaterializationPageMatch {
  matchedPageId: number | string;
  priority: number;
  source: PluginDefaultPageContractMaterializationPageMatchSource;
}

export interface PluginDefaultPageContractPageLookupRepository {
  findPageById(pageId: number | string): Promise<PluginDefaultPageContractPageSnapshot | undefined>;
}

export interface PluginDefaultPageContractAssociationSnapshotRepository {
  getAssociationSnapshot(): Promise<PluginDefaultPageContractBackfillAssociationSnapshot>;
}

export interface PluginDefaultPageContractAssociationPersistInput {
  canonicalKey: string;
  pageId: number | string;
}

export interface PluginDefaultPageContractAssociationPersistResult {
  canonicalKey: string;
  pageId: number | string;
  status: PluginDefaultPageContractAssociationPersistStatus;
  reason?: string;
}

export interface PluginDefaultPageContractAssociationPersistRepository {
  persistAssociation(
    input: PluginDefaultPageContractAssociationPersistInput,
  ): Promise<PluginDefaultPageContractAssociationPersistResult>;
}

export interface PluginDefaultPageContractMaterializationExecutionInput {
  plan: PluginDefaultPageContractMaterializationPlan;
  pageLookupRepository: PluginDefaultPageContractPageLookupRepository;
  associationSnapshotRepository: PluginDefaultPageContractAssociationSnapshotRepository;
  associationPersistRepository: PluginDefaultPageContractAssociationPersistRepository;
}

export interface PluginDefaultPageContractMaterializationExecutionEntrySummary {
  canonicalKey: string;
  namespace: string;
  pluginSlug: string;
  key: string;
  action: PluginDefaultPageContractMaterializationAction;
  status: PluginDefaultPageContractMaterializationStatus;
  materializationMode: PluginDefaultPageContractMaterializationMode;
  matchedPageId?: number | string;
  executionOutcome: PluginDefaultPageContractMaterializationExecutionOutcome;
  reasons: string[];
}

export interface PluginDefaultPageContractMaterializationExecutionReportSummary {
  total: number;
  byOutcome: Record<PluginDefaultPageContractMaterializationExecutionOutcome, number>;
}

export interface PluginDefaultPageContractMaterializationExecutionReport {
  entries: PluginDefaultPageContractMaterializationExecutionEntrySummary[];
  summary: PluginDefaultPageContractMaterializationExecutionReportSummary;
}