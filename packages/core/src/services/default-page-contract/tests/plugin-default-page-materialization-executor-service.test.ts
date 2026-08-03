import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { IPluginDefaultPageContractAssociationPersistInput } from '@core/default-page-contract/interfaces/plugin-default-page-contract-association-persist-input.interface';
import type { IPluginDefaultPageContractAssociationPersistResult } from '@core/default-page-contract/interfaces/plugin-default-page-contract-association-persist-result.interface';
import type { IPluginDefaultPageContractBackfillAssociationSnapshot } from '@core/default-page-contract/interfaces/plugin-default-page-contract-backfill-association-snapshot.interface';
import type { IPluginDefaultPageContractMaterializationExecutionInput } from '@core/default-page-contract/interfaces/plugin-default-page-contract-materialization-execution-input.interface';
import type { IPluginDefaultPageContractMaterializationPlan } from '@core/default-page-contract/interfaces/plugin-default-page-contract-materialization-plan.interface';
import type { IPluginDefaultPageContractMaterializationPlanEntry } from '@core/default-page-contract/interfaces/plugin-default-page-contract-materialization-plan-entry.interface';
import type { IPluginDefaultPageContractPageSnapshot } from '@core/default-page-contract/interfaces/plugin-default-page-contract-page-snapshot.interface';
import { PluginDefaultPageBackfillAssociationService } from '@core/services/default-page-contract/plugin-default-page-backfill-association-service';
import { PluginDefaultPageMaterializationExecutorService } from '@core/services/default-page-contract/plugin-default-page-materialization-executor-service';
import { PluginDefaultPageContractMaterializationMode } from '@core/default-page-contract/enums/plugin-default-page-contract-materialization-mode.enum';
import { PluginDefaultPageContractAssociationPersistStatus } from '@core/default-page-contract/enums/plugin-default-page-contract-association-persist-status.enum';
import { PluginDefaultPageContractMaterializationStatus } from '@core/default-page-contract/enums/plugin-default-page-contract-materialization-status.enum';
import { PluginDefaultPageContractMaterializationExecutionOutcome } from '@core/default-page-contract/enums/plugin-default-page-contract-materialization-execution-outcome.enum';
import { PluginDefaultPageContractMaterializationAction } from '@core/default-page-contract/enums/plugin-default-page-contract-materialization-action.enum';

const TEST_NAMESPACE = 'org.synthetic';
const CATALOG_CANONICAL_KEY = 'org.synthetic:catalog-module:catalog-index';
const CONTACT_CANONICAL_KEY = 'org.synthetic:contact-module:contact-page';
const CREATE_CANONICAL_KEY = 'org.synthetic:catalog-module:create-missing';
const BLOCKED_CANONICAL_KEY = 'org.synthetic:catalog-module:blocked';

describe('PluginDefaultPageMaterializationExecutorService', () => {
  let service: PluginDefaultPageMaterializationExecutorService;

  beforeEach(() => {
    service = new PluginDefaultPageMaterializationExecutorService(new PluginDefaultPageBackfillAssociationService());
  });

  it('associates an eligible adopt-existing entry successfully', async () => {
    const persistAssociation = vi.fn(async (input: IPluginDefaultPageContractAssociationPersistInput) => {
      return createPersistResult({
        canonicalKey: input.canonicalKey,
        pageId: input.pageId,
        status: PluginDefaultPageContractAssociationPersistStatus.APPLIED,
      });
    });
    const report = await service.execute(
      createExecutionInput({
        plan: createPlan([createReadyAdoptEntry()]),
        existingPages: [{ id: 42, customPermalink: '/catalog' }],
        associationSnapshot: {},
        persistAssociation,
      }),
    );

    expect(report.entries).toEqual([
      expect.objectContaining({
        canonicalKey: CATALOG_CANONICAL_KEY,
        executionOutcome: PluginDefaultPageContractMaterializationExecutionOutcome.APPLIED,
        matchedPageId: 42,
        reasons: ['matched-by-customPermalink'],
      }),
    ]);
    expect(report.summary.byOutcome).toEqual({ applied: 1, failed: 0, noop: 0, skipped: 0 });
    expect(persistAssociation).toHaveBeenCalledTimes(1);
    expect(persistAssociation).toHaveBeenCalledWith({
      canonicalKey: CATALOG_CANONICAL_KEY,
      pageId: 42,
    });
  });

  it('returns noop without writing when the association already exists', async () => {
    const persistAssociation = vi.fn();
    const report = await service.execute(
      createExecutionInput({
        plan: createPlan([createReadyAdoptEntry()]),
        existingPages: [{ id: 42, customPermalink: '/catalog' }],
        associationSnapshot: {
          byCanonicalKey: {
            [CATALOG_CANONICAL_KEY]: {
              canonicalKey: CATALOG_CANONICAL_KEY,
              pageId: 42,
            },
          },
          byPageId: {
            '42': {
              canonicalKey: CATALOG_CANONICAL_KEY,
              pageId: 42,
            },
          },
        },
        persistAssociation,
      }),
    );

    expect(report.entries[0]).toEqual(
      expect.objectContaining({
        executionOutcome: PluginDefaultPageContractMaterializationExecutionOutcome.NOOP,
        matchedPageId: 42,
        reasons: ['matched-by-customPermalink'],
      }),
    );
    expect(report.summary.byOutcome.noop).toBe(1);
    expect(persistAssociation).not.toHaveBeenCalled();
  });

  it('returns noop when persistAssociation reports the same association was already materialized', async () => {
    const persistAssociation = vi.fn(async (input: IPluginDefaultPageContractAssociationPersistInput) => {
      return createPersistResult({
        canonicalKey: input.canonicalKey,
        pageId: input.pageId,
        status: PluginDefaultPageContractAssociationPersistStatus.NOOP,
      });
    });
    const report = await service.execute(
      createExecutionInput({
        plan: createPlan([createReadyAdoptEntry()]),
        existingPages: [{ id: 42, customPermalink: '/catalog' }],
        associationSnapshot: {},
        persistAssociation,
      }),
    );

    expect(report.entries[0]).toEqual(
      expect.objectContaining({
        canonicalKey: CATALOG_CANONICAL_KEY,
        executionOutcome: PluginDefaultPageContractMaterializationExecutionOutcome.NOOP,
        matchedPageId: 42,
        reasons: ['matched-by-customPermalink'],
      }),
    );
    expect(report.summary.byOutcome).toEqual({ applied: 0, failed: 0, noop: 1, skipped: 0 });
    expect(persistAssociation).toHaveBeenCalledTimes(1);
    expect(persistAssociation).toHaveBeenCalledWith({
      canonicalKey: CATALOG_CANONICAL_KEY,
      pageId: 42,
    });
  });

  it('fails closed when persistAssociation reports a competing association conflict', async () => {
    const persistAssociation = vi.fn(async (input: IPluginDefaultPageContractAssociationPersistInput) => {
      return createPersistResult({
        canonicalKey: input.canonicalKey,
        pageId: input.pageId,
        status: PluginDefaultPageContractAssociationPersistStatus.CONFLICT,
        reason: 'contract-already-associated-to-different-page',
      });
    });
    const report = await service.execute(
      createExecutionInput({
        plan: createPlan([createReadyAdoptEntry()]),
        existingPages: [{ id: 42, customPermalink: '/catalog' }],
        associationSnapshot: {},
        persistAssociation,
      }),
    );

    expect(report.entries[0]).toEqual(
      expect.objectContaining({
        canonicalKey: CATALOG_CANONICAL_KEY,
        executionOutcome: PluginDefaultPageContractMaterializationExecutionOutcome.FAILED,
        matchedPageId: 42,
        reasons: ['matched-by-customPermalink', 'contract-already-associated-to-different-page'],
      }),
    );
    expect(report.summary.byOutcome).toEqual({ applied: 0, failed: 1, noop: 0, skipped: 0 });
    expect(persistAssociation).toHaveBeenCalledTimes(1);
    expect(persistAssociation).toHaveBeenCalledWith({
      canonicalKey: CATALOG_CANONICAL_KEY,
      pageId: 42,
    });
  });

  it('fails closed when the matched page no longer exists', async () => {
    const persistAssociation = vi.fn();
    const report = await service.execute(
      createExecutionInput({
        plan: createPlan([createReadyAdoptEntry()]),
        existingPages: [],
        associationSnapshot: {},
        persistAssociation,
      }),
    );

    expect(report.entries[0]).toEqual(
      expect.objectContaining({
        executionOutcome: PluginDefaultPageContractMaterializationExecutionOutcome.FAILED,
        reasons: ['matched-by-customPermalink', 'matched-page-missing'],
      }),
    );
    expect(persistAssociation).not.toHaveBeenCalled();
  });

  it('fails closed when the matched page still exists but no longer matches the lookup candidates', async () => {
    const persistAssociation = vi.fn();
    const report = await service.execute(
      createExecutionInput({
        plan: createPlan([createReadyAdoptEntry()]),
        existingPages: [{ id: 42, slug: 'storefront', customPermalink: '/storefront' }],
        associationSnapshot: {},
        persistAssociation,
      }),
    );

    expect(report.entries[0]).toEqual(
      expect.objectContaining({
        executionOutcome: PluginDefaultPageContractMaterializationExecutionOutcome.FAILED,
        matchedPageId: undefined,
        reasons: ['matched-by-customPermalink', 'matched-page-no-longer-matches-lookup-candidates'],
      }),
    );
    expect(persistAssociation).not.toHaveBeenCalled();
  });

  it('fails closed when the canonical key is associated to a different page', async () => {
    const persistAssociation = vi.fn();
    const report = await service.execute(
      createExecutionInput({
        plan: createPlan([createReadyAdoptEntry()]),
        existingPages: [{ id: 42, customPermalink: '/catalog' }],
        associationSnapshot: {
          byCanonicalKey: {
            [CATALOG_CANONICAL_KEY]: {
              canonicalKey: CATALOG_CANONICAL_KEY,
              pageId: 10,
            },
          },
        },
        persistAssociation,
      }),
    );

    expect(report.entries[0]).toEqual(
      expect.objectContaining({
        executionOutcome: PluginDefaultPageContractMaterializationExecutionOutcome.FAILED,
        reasons: ['matched-by-customPermalink', 'contract-already-associated-to-different-page'],
      }),
    );
    expect(persistAssociation).not.toHaveBeenCalled();
  });

  it('fails closed when the page id is associated to a different canonical key', async () => {
    const persistAssociation = vi.fn();
    const report = await service.execute(
      createExecutionInput({
        plan: createPlan([createReadyAdoptEntry()]),
        existingPages: [{ id: 42, customPermalink: '/catalog' }],
        associationSnapshot: {
          byPageId: {
            '42': {
              canonicalKey: CONTACT_CANONICAL_KEY,
              pageId: 42,
            },
          },
        },
        persistAssociation,
      }),
    );

    expect(report.entries[0]).toEqual(
      expect.objectContaining({
        executionOutcome: PluginDefaultPageContractMaterializationExecutionOutcome.FAILED,
        reasons: ['matched-by-customPermalink', 'matched-page-already-associated-to-different-contract'],
      }),
    );
    expect(persistAssociation).not.toHaveBeenCalled();
  });

  it('creates and associates an eligible create-missing entry successfully', async () => {
    const createPage = vi.fn(async () => ({
      id: 51,
      slug: 'catalog',
      customPermalink: '/catalog',
      title: 'Catalog',
      status: 'published',
    }));
    const persistAssociation = vi.fn(async (input: IPluginDefaultPageContractAssociationPersistInput) => {
      return createPersistResult({
        canonicalKey: input.canonicalKey,
        pageId: input.pageId,
        status: PluginDefaultPageContractAssociationPersistStatus.APPLIED,
      });
    });

    const report = await service.execute(
      createExecutionInput({
        plan: createPlan([
          createPlanEntry({
            canonicalKey: CREATE_CANONICAL_KEY,
            key: 'create-missing',
            action: PluginDefaultPageContractMaterializationAction.CREATE_MISSING,
            status: PluginDefaultPageContractMaterializationStatus.READY,
            reasons: ['no-existing-page-match'],
            lookupCandidates: ['/catalog'],
            createPayload: {
              canonicalKey: CREATE_CANONICAL_KEY,
              namespace: TEST_NAMESPACE,
              pluginSlug: 'catalog-module',
              key: 'create-missing',
              slug: 'catalog',
              customPermalink: '/catalog',
              aliases: [],
              recipe: 'catalog-module.catalog-index',
              title: 'Catalog',
              themeLayout: 'CatalogLayout',
            },
          }),
        ]),
        existingPages: [],
        associationSnapshot: {},
        createPage,
        persistAssociation,
      }),
    );

    expect(report.entries).toEqual([
      expect.objectContaining({
        canonicalKey: CREATE_CANONICAL_KEY,
        executionOutcome: PluginDefaultPageContractMaterializationExecutionOutcome.APPLIED,
        matchedPageId: 51,
        reasons: ['no-existing-page-match'],
      }),
    ]);
    expect(createPage).toHaveBeenCalledTimes(1);
    expect(createPage).toHaveBeenCalledWith({
      canonicalKey: CREATE_CANONICAL_KEY,
      namespace: TEST_NAMESPACE,
      pluginSlug: 'catalog-module',
      key: 'create-missing',
      slug: 'catalog',
      customPermalink: '/catalog',
      aliases: [],
      recipe: 'catalog-module.catalog-index',
      title: 'Catalog',
      themeLayout: 'CatalogLayout',
    });
    expect(persistAssociation).toHaveBeenCalledWith({
      canonicalKey: CREATE_CANONICAL_KEY,
      pageId: 51,
    });
  });

  it('skips blocked entries without writing', async () => {
    const persistAssociation = vi.fn();
    const report = await service.execute(
      createExecutionInput({
        plan: createPlan([
          createPlanEntry({
            canonicalKey: BLOCKED_CANONICAL_KEY,
            key: 'blocked',
            action: PluginDefaultPageContractMaterializationAction.BLOCKED,
            status: PluginDefaultPageContractMaterializationStatus.BLOCKED,
            reasons: ['install-disabled'],
          }),
        ]),
        existingPages: [{ id: 42, customPermalink: '/catalog' }],
        associationSnapshot: {},
        persistAssociation,
      }),
    );

    expect(report.entries).toEqual([
      expect.objectContaining({ canonicalKey: BLOCKED_CANONICAL_KEY, executionOutcome: PluginDefaultPageContractMaterializationExecutionOutcome.SKIPPED, reasons: ['install-disabled'] }),
    ]);
    expect(report.summary.byOutcome.skipped).toBe(1);
    expect(persistAssociation).not.toHaveBeenCalled();
  });

  it('returns deterministic canonical-key ordering and summary counts', async () => {
    const persistAssociation = vi.fn(async (input: IPluginDefaultPageContractAssociationPersistInput) => {
      return createPersistResult({
        canonicalKey: input.canonicalKey,
        pageId: input.pageId,
        status: PluginDefaultPageContractAssociationPersistStatus.APPLIED,
      });
    });
    const report = await service.execute(
      createExecutionInput({
        plan: createPlan([
          createPlanEntry({
            canonicalKey: 'org.synthetic:zeta-module:skipped',
            namespace: TEST_NAMESPACE,
            pluginSlug: 'zeta-module',
            key: 'skipped',
            action: PluginDefaultPageContractMaterializationAction.BLOCKED,
            status: PluginDefaultPageContractMaterializationStatus.BLOCKED,
            reasons: ['disabled'],
          }),
          createPlanEntry({
            canonicalKey: 'org.synthetic:alpha-module:existing',
            namespace: TEST_NAMESPACE,
            pluginSlug: 'alpha-module',
            key: 'existing',
            matchedPageId: 10,
            reasons: ['matched-by-customPermalink'],
          }),
          createPlanEntry({
            canonicalKey: 'org.synthetic:beta-module:missing-page',
            namespace: TEST_NAMESPACE,
            pluginSlug: 'beta-module',
            key: 'missing-page',
            matchedPageId: 77,
            reasons: ['matched-by-customPermalink'],
          }),
        ]),
        existingPages: [{ id: 10, customPermalink: '/catalog' }],
        associationSnapshot: {},
        persistAssociation,
      }),
    );

    expect(report.entries.map((entry) => entry.canonicalKey)).toEqual([
      'org.synthetic:alpha-module:existing',
      'org.synthetic:beta-module:missing-page',
      'org.synthetic:zeta-module:skipped',
    ]);
    expect(report.summary).toEqual({
      total: 3,
      byOutcome: {
        applied: 1,
        failed: 1,
        noop: 0,
        skipped: 1,
      },
    });
  });
});

function createExecutionInput(overrides: {
  plan: IPluginDefaultPageContractMaterializationPlan;
  existingPages: IPluginDefaultPageContractPageSnapshot[];
  associationSnapshot: IPluginDefaultPageContractBackfillAssociationSnapshot;
  createPage?: (payload: any) => Promise<IPluginDefaultPageContractPageSnapshot | undefined>;
  persistAssociation?: (input: IPluginDefaultPageContractAssociationPersistInput) => Promise<IPluginDefaultPageContractAssociationPersistResult>;
}): IPluginDefaultPageContractMaterializationExecutionInput {
  const pagesById = new Map(overrides.existingPages.map((page) => [String(page.id), page]));

  return {
    plan: overrides.plan,
    pageLookupRepository: {
      async findPageById(pageId: number | string): Promise<IPluginDefaultPageContractPageSnapshot | undefined> {
        return pagesById.get(String(pageId));
      },
    },
    pageCreateRepository: {
      async createPage(payload): Promise<IPluginDefaultPageContractPageSnapshot | undefined> {
        if (overrides.createPage) {
          return overrides.createPage(payload);
        }

        return undefined;
      },
    },
    associationSnapshotRepository: {
      async getAssociationSnapshot(): Promise<IPluginDefaultPageContractBackfillAssociationSnapshot> {
        return overrides.associationSnapshot;
      },
    },
    associationPersistRepository: {
      async persistAssociation(
        input: IPluginDefaultPageContractAssociationPersistInput,
      ): Promise<IPluginDefaultPageContractAssociationPersistResult> {
        if (overrides.persistAssociation) {
          return overrides.persistAssociation(input);
        }

        return createPersistResult({
          canonicalKey: input.canonicalKey,
          pageId: input.pageId,
          status: PluginDefaultPageContractAssociationPersistStatus.APPLIED,
        });
      },
    },
  };
}

function createPlan(entries: IPluginDefaultPageContractMaterializationPlanEntry[]): IPluginDefaultPageContractMaterializationPlan {
  return {
    entries,
    summary: {
      total: entries.length,
      byAction: {
        'adopt-existing': entries.filter((entry) => entry.action === 'adopt-existing').length,
        ambiguous: entries.filter((entry) => entry.action === 'ambiguous').length,
        blocked: entries.filter((entry) => entry.action === 'blocked').length,
        'create-missing': entries.filter((entry) => entry.action === 'create-missing').length,
        deferred: entries.filter((entry) => entry.action === 'deferred').length,
        skip: entries.filter((entry) => entry.action === 'skip').length,
      },
      byStatus: {
        ambiguous: entries.filter((entry) => entry.status === 'ambiguous').length,
        blocked: entries.filter((entry) => entry.status === 'blocked').length,
        deferred: entries.filter((entry) => entry.status === 'deferred').length,
        ready: entries.filter((entry) => entry.status === 'ready').length,
        skipped: entries.filter((entry) => entry.status === 'skipped').length,
      },
    },
  };
}

function createReadyAdoptEntry(overrides: Partial<IPluginDefaultPageContractMaterializationPlanEntry> = {}): IPluginDefaultPageContractMaterializationPlanEntry {
  return createPlanEntry({
    matchedPageId: 42,
    reasons: ['matched-by-customPermalink'],
    ...overrides,
  });
}

function createPlanEntry(overrides: Partial<IPluginDefaultPageContractMaterializationPlanEntry> = {}): IPluginDefaultPageContractMaterializationPlanEntry {
  return {
    canonicalKey: CATALOG_CANONICAL_KEY,
    namespace: TEST_NAMESPACE,
    pluginSlug: 'catalog-module',
    key: 'catalog-index',
    action: PluginDefaultPageContractMaterializationAction.ADOPT_EXISTING,
    lookupCandidates: ['/catalog'],
    matchedPageId: undefined,
    createPayload: undefined,
    reasons: [],
    materializationMode: PluginDefaultPageContractMaterializationMode.SINGLETON_DOCUMENT,
    status: PluginDefaultPageContractMaterializationStatus.READY,
    ...overrides,
  };
}

function createPersistResult(
  overrides: Partial<IPluginDefaultPageContractAssociationPersistResult>,
): IPluginDefaultPageContractAssociationPersistResult {
  return {
    canonicalKey: CATALOG_CANONICAL_KEY,
    pageId: 42,
    status: PluginDefaultPageContractAssociationPersistStatus.APPLIED,
    ...overrides,
  };
}