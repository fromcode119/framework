import { SystemConstants } from '@core/constants/system.constants';
import type { IPluginDefaultPageContractBackfillAssociationSnapshot } from '@core/default-page-contract/interfaces/plugin-default-page-contract-backfill-association-snapshot.interface';
import type { IPluginDefaultPageContractBackfillAssociationSnapshotEntry } from '@core/default-page-contract/interfaces/plugin-default-page-contract-backfill-association-snapshot-entry.interface';
import type { IResolvedPluginDefaultPageContract } from '@core/default-page-contract/interfaces/resolved-plugin-default-page-contract.interface';
import { BaseService } from '@core/services/base-service';
import type { IPluginManagerInterface } from '@core/plugin/context/interfaces/plugin-manager-interface.interface';
import { PluginDefaultPageContractMaterializationMode } from '@core/default-page-contract/enums/plugin-default-page-contract-materialization-mode.enum';
import { PluginDefaultPageContractResolutionStatus } from '@core/default-page-contract/enums/plugin-default-page-contract-resolution-status.enum';
import { PluginDefaultPageContractAssociationPersistStatus } from '@core/default-page-contract/enums/plugin-default-page-contract-association-persist-status.enum';

/**
 * Association-snapshot persistence for the default-page materialization runtime. Reads and
 * writes the `default_page_contract_associations` meta record and derives the site-state
 * snapshot. Extracted from {@link PluginDefaultPageMaterializationRuntimeService}; behavior is
 * unchanged.
 */
export class PluginDefaultPageAssociationStore extends BaseService {
  static readonly ASSOCIATIONS_META_KEY = 'default_page_contract_associations';

  constructor(private readonly manager: IPluginManagerInterface) {
    super();
  }

  get serviceName(): string {
    return 'PluginDefaultPageAssociationStore';
  }

  async loadAssociationSnapshot(): Promise<IPluginDefaultPageContractBackfillAssociationSnapshot> {
    const row = await this.manager.db.findOne(SystemConstants.TABLE.META, {
      key: PluginDefaultPageAssociationStore.ASSOCIATIONS_META_KEY,
    });
    const parsed = this.parseAssociationSnapshot(row?.value);
    return parsed || {};
  }

  private parseAssociationSnapshot(value: any): IPluginDefaultPageContractBackfillAssociationSnapshot | null {
    if (!value) {
      return null;
    }

    if (typeof value === 'object') {
      return value as IPluginDefaultPageContractBackfillAssociationSnapshot;
    }

    try {
      return JSON.parse(String(value)) as IPluginDefaultPageContractBackfillAssociationSnapshot;
    } catch {
      return null;
    }
  }

  /**
   * Forgets associations whose page is gone, and returns the snapshot that is actually true.
   *
   * An association is a claim about a row in the pages table. Delete that row and the claim outlives
   * it: the contract stays "already associated" to an id nothing can match, every later pass reports
   * `contract-already-associated-to-different-page`, and — because a required route that fails takes
   * the plugin's registration with it — the site 404s until someone hand-edits `_system_meta`. That
   * happened, twice, and only a manual DB edit brought the storefront back.
   *
   * Both directions are pruned. `createMaps` rebuilds a canonical→page mapping out of a `byPageId`
   * entry alone, so a half-pruned snapshot resurrects the very claim this removes.
   */
  async pruneAssociationsForMissingPages(existingPageIds: Array<number | string>): Promise<IPluginDefaultPageContractBackfillAssociationSnapshot> {
    const snapshot = await this.loadAssociationSnapshot();
    const livePageIds = new Set(existingPageIds.map((pageId) => String(pageId)));
    const byCanonicalKey = this.retainLivePageEntries(snapshot.byCanonicalKey, livePageIds);
    const byPageId = this.retainLivePageEntries(snapshot.byPageId, livePageIds);
    const removed = this.countEntries(snapshot) - (Object.keys(byCanonicalKey).length + Object.keys(byPageId).length);

    if (!removed) {
      return snapshot;
    }

    const nextSnapshot: IPluginDefaultPageContractBackfillAssociationSnapshot = { byCanonicalKey, byPageId };
    await this.saveAssociationSnapshot(nextSnapshot);
    this.warn(`Dropped ${removed} default page association entr${removed === 1 ? 'y' : 'ies'} pointing at pages that no longer exist.`);

    return nextSnapshot;
  }

  private retainLivePageEntries(
    entries: Record<string, IPluginDefaultPageContractBackfillAssociationSnapshotEntry> | undefined,
    livePageIds: Set<string>,
  ): Record<string, IPluginDefaultPageContractBackfillAssociationSnapshotEntry> {
    return Object.fromEntries(
      Object.entries(entries || {}).filter(([, entry]) => livePageIds.has(String(entry?.pageId))),
    );
  }

  private countEntries(snapshot: IPluginDefaultPageContractBackfillAssociationSnapshot): number {
    return Object.keys(snapshot.byCanonicalKey || {}).length + Object.keys(snapshot.byPageId || {}).length;
  }

  createSiteStateSnapshot(
    snapshot: IPluginDefaultPageContractBackfillAssociationSnapshot,
    resolvedContracts: IResolvedPluginDefaultPageContract[],
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

        return [canonicalKey, { status: PluginDefaultPageContractResolutionStatus.READY, prerequisitesReady: true, reasons: ['materialized'] }];
      }).filter(Boolean) as Array<[string, { status: PluginDefaultPageContractResolutionStatus; prerequisitesReady: true; reasons: string[] }]>,
    );

    return { byCanonicalKey };
  }

  async persistAssociation(canonicalKey: string, pageId: number | string) {
    const snapshot = await this.loadAssociationSnapshot();
    const existingCanonical = snapshot.byCanonicalKey?.[canonicalKey];
    const existingPage = snapshot.byPageId?.[String(pageId)];

    if (existingCanonical?.pageId === pageId && existingPage?.canonicalKey === canonicalKey) {
      return { canonicalKey, pageId, status: PluginDefaultPageContractAssociationPersistStatus.NOOP };
    }
    if (existingCanonical && String(existingCanonical.pageId) !== String(pageId)) {
      return { canonicalKey, pageId, status: PluginDefaultPageContractAssociationPersistStatus.CONFLICT, reason: 'contract-already-associated-to-different-page' };
    }
    if (existingPage && existingPage.canonicalKey !== canonicalKey) {
      return { canonicalKey, pageId, status: PluginDefaultPageContractAssociationPersistStatus.CONFLICT, reason: 'matched-page-already-associated-to-different-contract' };
    }

    const nextSnapshot: IPluginDefaultPageContractBackfillAssociationSnapshot = {
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

    return { canonicalKey, pageId, status: PluginDefaultPageContractAssociationPersistStatus.APPLIED };
  }

  private async saveAssociationSnapshot(snapshot: IPluginDefaultPageContractBackfillAssociationSnapshot): Promise<void> {
    const existing = await this.manager.db.findOne(SystemConstants.TABLE.META, {
      key: PluginDefaultPageAssociationStore.ASSOCIATIONS_META_KEY,
    });
    const value = JSON.stringify(snapshot);

    if (existing) {
      await this.manager.db.update(SystemConstants.TABLE.META, { key: PluginDefaultPageAssociationStore.ASSOCIATIONS_META_KEY }, { value });
      return;
    }

    await this.manager.db.insert(SystemConstants.TABLE.META, {
      key: PluginDefaultPageAssociationStore.ASSOCIATIONS_META_KEY,
      value,
    });
  }

  private isRuntimeParameterizedContract(contract: IResolvedPluginDefaultPageContract): boolean {
    return contract.materializationMode === PluginDefaultPageContractMaterializationMode.SINGLETON_DOCUMENT && this.hasPathParameters(contract.effectiveSlug);
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
