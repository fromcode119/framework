import { SystemConstants } from '@core/constants/system.constants';
import type { IPluginDefaultPageContractBackfillAssociationSnapshot } from '@core/default-page-contract/interfaces/plugin-default-page-contract-backfill-association-snapshot.interface';
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
