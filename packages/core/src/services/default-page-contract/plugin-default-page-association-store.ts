import { SystemConstants } from '../../constants';
import type {
  PluginDefaultPageContractBackfillAssociationSnapshot,
  ResolvedPluginDefaultPageContract,
} from '../../types';
import { BaseService } from '../base-service';
import type { PluginManagerInterface } from '../../plugin/context/utils.interfaces';

/**
 * Association-snapshot persistence for the default-page materialization runtime. Reads and
 * writes the `default_page_contract_associations` meta record and derives the site-state
 * snapshot. Extracted from {@link PluginDefaultPageMaterializationRuntimeService}; behavior is
 * unchanged.
 */
export class PluginDefaultPageAssociationStore extends BaseService {
  static readonly ASSOCIATIONS_META_KEY = 'default_page_contract_associations';

  constructor(private readonly manager: PluginManagerInterface) {
    super();
  }

  get serviceName(): string {
    return 'PluginDefaultPageAssociationStore';
  }

  async loadAssociationSnapshot(): Promise<PluginDefaultPageContractBackfillAssociationSnapshot> {
    const row = await this.manager.db.findOne(SystemConstants.TABLE.META, {
      key: PluginDefaultPageAssociationStore.ASSOCIATIONS_META_KEY,
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

  createSiteStateSnapshot(
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

  async persistAssociation(canonicalKey: string, pageId: number | string) {
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
