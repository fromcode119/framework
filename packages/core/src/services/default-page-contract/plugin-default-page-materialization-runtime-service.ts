import { SystemConstants } from '../../constants';
import type {
  Collection,
  CollectionQueryInterface,
  PluginDefaultPageContractBackfillAssociationSnapshot,
  PluginDefaultPageContractCreatePayload,
  PluginDefaultPageContractMaterializationExecutionReport,
  PluginDefaultPageContractPageSnapshot,
  ResolvedPluginDefaultPageContract,
  ThemeDefaultPageContractOverride,
} from '../../types';
import { BaseService } from '../base-service';
import { CoreServices } from '../core-services';
import { SeedPageService } from '../seed-page-service';
import { PluginDefaultPageBackfillAssociationService } from './plugin-default-page-backfill-association-service';
import { PluginDefaultPageMaterializationExecutorService } from './plugin-default-page-materialization-executor-service';
import type { PluginManagerInterface } from '../../plugin/context/utils.interfaces';

export class PluginDefaultPageMaterializationRuntimeService extends BaseService {
  private static readonly ASSOCIATIONS_META_KEY = 'default_page_contract_associations';
  private static readonly REQUIRED_ROUTE_FAILURE_LABEL = 'Required route reconciliation failed';

  private readonly associationService = new PluginDefaultPageBackfillAssociationService();
  private readonly executor = new PluginDefaultPageMaterializationExecutorService(this.associationService);
  private readonly seedPageService = new SeedPageService();

  constructor(
    private readonly manager: PluginManagerInterface,
    private readonly overridesProvider?: () => Promise<ThemeDefaultPageContractOverride[]>,
  ) {
    super();
  }

  get serviceName(): string {
    return 'PluginDefaultPageMaterializationRuntimeService';
  }

  async materialize(): Promise<PluginDefaultPageContractMaterializationExecutionReport | null> {
    const associationSnapshot = await this.loadAssociationSnapshot();
    const overrides = await this.loadOverrides();
    const preliminaryContracts = CoreServices.getInstance().defaultPageContractResolution.resolveAll({
      overrides,
    });
    const resolvedContracts = CoreServices.getInstance().defaultPageContractResolution.resolveAll({
      overrides,
      siteState: this.createSiteStateSnapshot(associationSnapshot, preliminaryContracts),
    });
    const pagesEntry = this.findPagesCollectionEntry();

    if (!pagesEntry) {
      this.warn('Skipping default page materialization because no registered page collection is available.');
      return null;
    }

    const existingPages = await this.loadExistingPages(pagesEntry.collection);
    const plan = CoreServices.getInstance().defaultPageMaterialization.createPlan({
      resolvedContracts,
      existingPages,
    });

    const report = await this.executor.execute({
      plan,
      pageLookupRepository: {
        findPageById: async (pageId) => this.findPageById(pagesEntry.collection, pageId),
      },
      pageCreateRepository: {
        createPage: async (payload) => this.createPage(pagesEntry.collection, payload),
      },
      associationSnapshotRepository: {
        getAssociationSnapshot: async () => this.loadAssociationSnapshot(),
      },
      associationPersistRepository: {
        persistAssociation: async (input) => this.persistAssociation(input.canonicalKey, input.pageId),
      },
    });

    await this.reconcileMaterializedPageMetadata(pagesEntry.collection, report, resolvedContracts);
    this.assertRequiredRouteReconciliation(report, resolvedContracts);

    return report;
  }

  static isRequiredRouteFailure(error: unknown): boolean {
    const message = error instanceof Error ? error.message : String(error || '');
    return message.includes(PluginDefaultPageMaterializationRuntimeService.REQUIRED_ROUTE_FAILURE_LABEL);
  }

  private async loadOverrides(): Promise<ThemeDefaultPageContractOverride[]> {
    if (!this.overridesProvider) {
      return [];
    }

    return await this.overridesProvider();
  }

  private findPagesCollectionEntry(): { collection: Collection; pluginSlug: string } | null {
    for (const entry of this.manager.registeredCollections.values()) {
      if ((entry.collection.shortSlug || entry.collection.slug) === 'pages') {
        return entry;
      }
    }

    return null;
  }

  private async loadExistingPages(collection: Collection): Promise<PluginDefaultPageContractPageSnapshot[]> {
    const rows = await this.manager.db.find(this.resolveCollectionTarget(collection), { limit: 5000 });
    return Array.isArray(rows) ? rows.map((row: any) => this.toPageSnapshot(row)).filter(Boolean) : [];
  }

  private async findPageById(collection: Collection, pageId: number | string): Promise<PluginDefaultPageContractPageSnapshot | undefined> {
    const primaryKey = collection.primaryKey || 'id';
    const row = await this.manager.db.findOne(this.resolveCollectionTarget(collection), { [primaryKey]: pageId });
    return row ? this.toPageSnapshot(row) : undefined;
  }

  private async createPage(collection: Collection, payload: PluginDefaultPageContractCreatePayload): Promise<PluginDefaultPageContractPageSnapshot | undefined> {
    const query = this.createCollectionQuery(collection);
    const lookupCandidates = this.seedPageService.buildPageLookupCandidates(payload.aliases || [], {
      customPermalink: payload.customPermalink,
      slug: payload.slug,
    });
    const result = await CoreServices.getInstance().collectionWriteCompatibility.findAndUpsert(
      query,
      lookupCandidates,
      this.buildPagePayload(collection, payload),
      {
        targetKey: collection.slug,
        fields: ['slug', 'customPermalink'],
        scanLimit: 5000,
      },
    );

    return result?.record ? this.toPageSnapshot(result.record) : undefined;
  }

  private buildPagePayload(collection: Collection, payload: PluginDefaultPageContractCreatePayload): Record<string, any> {
    const fieldNames = new Set((collection.fields || []).map((field) => String(field?.name || '').trim()).filter(Boolean));
    const pagePayload: Record<string, any> = {
      slug: payload.slug,
      customPermalink: payload.customPermalink,
      disablePermalink: false,
    };

    if (fieldNames.has('title')) {
      pagePayload.title = payload.title || this.createFallbackTitle(payload.slug);
    }
    if (fieldNames.has('content')) {
      pagePayload.content = [];
    }
    if (fieldNames.has('status')) {
      pagePayload.status = 'published';
    }
    if (fieldNames.has('publishedAt')) {
      pagePayload.publishedAt = new Date().toISOString();
    }
    if (fieldNames.has('recipe') && payload.recipe) {
      pagePayload.recipe = payload.recipe;
    }
    if (fieldNames.has('themeLayout') && payload.themeLayout) {
      pagePayload.themeLayout = payload.themeLayout;
    }

    return pagePayload;
  }

  private createCollectionQuery(collection: Collection): CollectionQueryInterface {
    const target = this.resolveCollectionTarget(collection);

    return {
      slug: collection.slug,
      find: async (options?: any) => this.manager.db.find(target, options),
      findOne: async (where: any) => this.manager.db.findOne(target, where),
      insert: async (data: any) => this.manager.db.insert(target, data),
      update: async (where: any, data: any) => this.manager.db.update(target, where, data),
      delete: async (where: any) => this.manager.db.delete(target, where),
      count: async (where?: any) => this.manager.db.count(target, where ? { where } : undefined),
    } as CollectionQueryInterface;
  }

  private resolveCollectionTarget(collection: Collection): string {
    return String(collection.tableName || collection.slug || '').trim();
  }

  private toPageSnapshot(row: any): PluginDefaultPageContractPageSnapshot {
    return {
      id: row?.id,
      slug: row?.slug,
      customPermalink: row?.customPermalink ?? row?.custom_permalink,
      title: row?.title,
      status: row?.status,
    };
  }

  private async loadAssociationSnapshot(): Promise<PluginDefaultPageContractBackfillAssociationSnapshot> {
    const row = await this.manager.db.findOne(SystemConstants.TABLE.META, {
      key: PluginDefaultPageMaterializationRuntimeService.ASSOCIATIONS_META_KEY,
    });
    const parsed = this.parseAssociationSnapshot(row?.value);
    return parsed || {};
  }

  private parseAssociationSnapshot(value: any): PluginDefaultPageContractBackfillAssociationSnapshot | null {
    if (!value) {
      return null;
    }

    if (typeof value === 'object') {
      return value as PluginDefaultPageContractBackfillAssociationSnapshot;
    }

    try {
      return JSON.parse(String(value)) as PluginDefaultPageContractBackfillAssociationSnapshot;
    } catch {
      return null;
    }
  }

  private createSiteStateSnapshot(
    snapshot: PluginDefaultPageContractBackfillAssociationSnapshot,
    resolvedContracts: ResolvedPluginDefaultPageContract[],
  ) {
    const runtimeParameterizedContracts = new Set(
      resolvedContracts
        .filter((contract) => this.isRuntimeParameterizedContract(contract))
        .map((contract) => contract.canonicalKey),
    );
    const byCanonicalKey = Object.fromEntries(
      Object.keys(snapshot?.byCanonicalKey || {}).map((canonicalKey) => {
        if (runtimeParameterizedContracts.has(canonicalKey)) {
          return null;
        }

        return [canonicalKey, { status: 'ready' as const, prerequisitesReady: true, reasons: ['materialized'] }];
      }).filter(Boolean) as Array<[string, { status: 'ready'; prerequisitesReady: true; reasons: string[] }]>,
    );

    return { byCanonicalKey };
  }

  private assertRequiredRouteReconciliation(
    report: PluginDefaultPageContractMaterializationExecutionReport | null,
    resolvedContracts: ResolvedPluginDefaultPageContract[],
  ): void {
    const reportByCanonicalKey = new Map((report?.entries || []).map((entry) => [entry.canonicalKey, entry]));
    const failures = resolvedContracts
      .filter((contract) => contract.required)
      .flatMap((contract) => this.getRequiredRouteFailures(contract, reportByCanonicalKey, report));

    if (!failures.length) {
      return;
    }

    throw new Error(
      `[${this.serviceName}] ${PluginDefaultPageMaterializationRuntimeService.REQUIRED_ROUTE_FAILURE_LABEL}: ${failures.join('; ')}`,
    );
  }

  private getRequiredRouteFailures(
    contract: ResolvedPluginDefaultPageContract,
    reportByCanonicalKey: Map<string, PluginDefaultPageContractMaterializationExecutionReport['entries'][number]>,
    report: PluginDefaultPageContractMaterializationExecutionReport | null,
  ): string[] {
    if (!contract.install || contract.status !== 'ready') {
      return [this.formatRequiredRouteFailure(contract.canonicalKey, contract.reasons, 'contract-not-ready')];
    }

    if (this.isRuntimeParameterizedContract(contract) || contract.materializationMode !== 'singleton-document') {
      return [];
    }

    if (!report) {
      return [this.formatRequiredRouteFailure(contract.canonicalKey, [], 'pages-collection-missing')];
    }

    const entry = reportByCanonicalKey.get(contract.canonicalKey);
    if (!entry) {
      return [this.formatRequiredRouteFailure(contract.canonicalKey, [], 'reconciliation-entry-missing')];
    }

    if (entry.executionOutcome === 'applied' || entry.executionOutcome === 'noop') {
      return [];
    }

    return [this.formatRequiredRouteFailure(contract.canonicalKey, entry.reasons, entry.executionOutcome)];
  }

  private formatRequiredRouteFailure(canonicalKey: string, reasons: string[], fallbackReason: string): string {
    const normalizedReasons = Array.from(
      new Set(
        [...(reasons || []), fallbackReason]
          .map((reason) => String(reason || '').trim())
          .filter(Boolean),
      ),
    );

    return `${canonicalKey} (${normalizedReasons.join(', ')})`;
  }

  private async persistAssociation(canonicalKey: string, pageId: number | string) {
    const snapshot = await this.loadAssociationSnapshot();
    const existingCanonical = snapshot.byCanonicalKey?.[canonicalKey];
    const existingPage = snapshot.byPageId?.[String(pageId)];

    if (existingCanonical?.pageId === pageId && existingPage?.canonicalKey === canonicalKey) {
      return { canonicalKey, pageId, status: 'noop' as const };
    }
    if (existingCanonical && String(existingCanonical.pageId) !== String(pageId)) {
      return { canonicalKey, pageId, status: 'conflict' as const, reason: 'contract-already-associated-to-different-page' };
    }
    if (existingPage && existingPage.canonicalKey !== canonicalKey) {
      return { canonicalKey, pageId, status: 'conflict' as const, reason: 'matched-page-already-associated-to-different-contract' };
    }

    const nextSnapshot: PluginDefaultPageContractBackfillAssociationSnapshot = {
      byCanonicalKey: {
        ...(snapshot.byCanonicalKey || {}),
        [canonicalKey]: { canonicalKey, pageId },
      },
      byPageId: {
        ...(snapshot.byPageId || {}),
        [String(pageId)]: { canonicalKey, pageId },
      },
    };
    await this.saveAssociationSnapshot(nextSnapshot);

    return { canonicalKey, pageId, status: 'applied' as const };
  }

  private async saveAssociationSnapshot(snapshot: PluginDefaultPageContractBackfillAssociationSnapshot): Promise<void> {
    const existing = await this.manager.db.findOne(SystemConstants.TABLE.META, {
      key: PluginDefaultPageMaterializationRuntimeService.ASSOCIATIONS_META_KEY,
    });
    const value = JSON.stringify(snapshot);

    if (existing) {
      await this.manager.db.update(SystemConstants.TABLE.META, { key: PluginDefaultPageMaterializationRuntimeService.ASSOCIATIONS_META_KEY }, { value });
      return;
    }

    await this.manager.db.insert(SystemConstants.TABLE.META, {
      key: PluginDefaultPageMaterializationRuntimeService.ASSOCIATIONS_META_KEY,
      value,
    });
  }

  private async reconcileMaterializedPageMetadata(
    collection: Collection,
    report: PluginDefaultPageContractMaterializationExecutionReport,
    resolvedContracts: ResolvedPluginDefaultPageContract[],
  ): Promise<void> {
    const resolvedByCanonicalKey = new Map(resolvedContracts.map((contract) => [contract.canonicalKey, contract]));

    for (const entry of report.entries) {
      if (entry.matchedPageId === undefined) {
        continue;
      }
      if (entry.executionOutcome !== 'applied' && entry.executionOutcome !== 'noop') {
        continue;
      }

      const contract = resolvedByCanonicalKey.get(entry.canonicalKey);
      if (!contract) {
        continue;
      }

      await this.syncPageDesignMetadata(collection, entry.matchedPageId, contract);
    }
  }

  private async syncPageDesignMetadata(
    collection: Collection,
    pageId: number | string,
    contract: ResolvedPluginDefaultPageContract,
  ): Promise<void> {
    const fieldNames = new Set((collection.fields || []).map((field) => String(field?.name || '').trim()).filter(Boolean));
    const updateData: Record<string, any> = {};

    if (fieldNames.has('recipe') && contract.effectiveRecipe) {
      updateData.recipe = contract.effectiveRecipe;
    }
    if (fieldNames.has('themeLayout') && contract.effectiveThemeLayout) {
      updateData.themeLayout = contract.effectiveThemeLayout;
    }
    if (!Object.keys(updateData).length) {
      return;
    }

    const primaryKey = collection.primaryKey || 'id';
    await this.manager.db.update(this.resolveCollectionTarget(collection), { [primaryKey]: pageId }, updateData);
  }

  private createFallbackTitle(slug: string): string {
    return String(slug || '')
      .split('-')
      .filter(Boolean)
      .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
      .join(' ') || 'Page';
  }

  private isRuntimeParameterizedContract(contract: ResolvedPluginDefaultPageContract): boolean {
    return contract.materializationMode === 'singleton-document' && this.hasPathParameters(contract.effectiveSlug);
  }

  private hasPathParameters(value: string): boolean {
    return String(value || '')
      .trim()
      .split('?')[0]
      .split('#')[0]
      .split('/')
      .filter(Boolean)
      .some((segment) => segment.startsWith(':'));
  }
}