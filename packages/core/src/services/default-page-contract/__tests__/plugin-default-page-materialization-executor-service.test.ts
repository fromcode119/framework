import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  PluginDefaultPageContractAssociationPersistInput,
  PluginDefaultPageContractAssociationPersistResult,
  PluginDefaultPageContractBackfillAssociationSnapshot,
  PluginDefaultPageContractMaterializationExecutionInput,
  PluginDefaultPageContractMaterializationPlan,
  PluginDefaultPageContractMaterializationPlanEntry,
  PluginDefaultPageContractPageSnapshot,
} from '../../../types';
import { PluginDefaultPageBackfillAssociationService } from '../plugin-default-page-backfill-association-service';
import { PluginDefaultPageMaterializationExecutorService } from '../plugin-default-page-materialization-executor-service';

describe('PluginDefaultPageMaterializationExecutorService', () => {
  let service: PluginDefaultPageMaterializationExecutorService;

  beforeEach(() => {
    service = new PluginDefaultPageMaterializationExecutorService(new PluginDefaultPageBackfillAssociationService());
  });

  it('associates an eligible adopt-existing entry successfully', async () => {
    const persistAssociation = vi.fn(async (input: PluginDefaultPageContractAssociationPersistInput) => {
      return createPersistResult({
        canonicalKey: input.canonicalKey,
        pageId: input.pageId,
        status: 'applied',
      });
    });
    const report = await service.execute(
      createExecutionInput({
        plan: createPlan([createReadyAdoptEntry()]),
        existingPages: [{ id: 42, customPermalink: '/shop' }],
        associationSnapshot: {},
        persistAssociation,
      }),
    );

    expect(report.entries).toEqual([
      expect.objectContaining({
        canonicalKey: 'org.fromcode:ecommerce:store-index',
        executionOutcome: 'applied',
        matchedPageId: 42,
        reasons: ['matched-by-customPermalink'],
      }),
    ]);
    expect(report.summary.byOutcome).toEqual({ applied: 1, failed: 0, noop: 0, skipped: 0 });
    expect(persistAssociation).toHaveBeenCalledTimes(1);
    expect(persistAssociation).toHaveBeenCalledWith({
      canonicalKey: 'org.fromcode:ecommerce:store-index',
      pageId: 42,
    });
  });

  it('returns noop without writing when the association already exists', async () => {
    const persistAssociation = vi.fn();
    const report = await service.execute(
      createExecutionInput({
        plan: createPlan([createReadyAdoptEntry()]),
        existingPages: [{ id: 42, customPermalink: '/shop' }],
        associationSnapshot: {
          byCanonicalKey: {
            'org.fromcode:ecommerce:store-index': {
              canonicalKey: 'org.fromcode:ecommerce:store-index',
              pageId: 42,
            },
          },
          byPageId: {
            '42': {
              canonicalKey: 'org.fromcode:ecommerce:store-index',
              pageId: 42,
            },
          },
        },
        persistAssociation,
      }),
    );

    expect(report.entries[0]).toEqual(
      expect.objectContaining({
        executionOutcome: 'noop',
        matchedPageId: 42,
        reasons: ['matched-by-customPermalink'],
      }),
    );
    expect(report.summary.byOutcome.noop).toBe(1);
    expect(persistAssociation).not.toHaveBeenCalled();
  });

  it('returns noop when persistAssociation reports the same association was already materialized', async () => {
    const persistAssociation = vi.fn(async (input: PluginDefaultPageContractAssociationPersistInput) => {
      return createPersistResult({
        canonicalKey: input.canonicalKey,
        pageId: input.pageId,
        status: 'noop',
      });
    });
    const report = await service.execute(
      createExecutionInput({
        plan: createPlan([createReadyAdoptEntry()]),
        existingPages: [{ id: 42, customPermalink: '/shop' }],
        associationSnapshot: {},
        persistAssociation,
      }),
    );

    expect(report.entries[0]).toEqual(
      expect.objectContaining({
        canonicalKey: 'org.fromcode:ecommerce:store-index',
        executionOutcome: 'noop',
        matchedPageId: 42,
        reasons: ['matched-by-customPermalink'],
      }),
    );
    expect(report.summary.byOutcome).toEqual({ applied: 0, failed: 0, noop: 1, skipped: 0 });
    expect(persistAssociation).toHaveBeenCalledTimes(1);
    expect(persistAssociation).toHaveBeenCalledWith({
      canonicalKey: 'org.fromcode:ecommerce:store-index',
      pageId: 42,
    });
  });

  it('fails closed when persistAssociation reports a competing association conflict', async () => {
    const persistAssociation = vi.fn(async (input: PluginDefaultPageContractAssociationPersistInput) => {
      return createPersistResult({
        canonicalKey: input.canonicalKey,
        pageId: input.pageId,
        status: 'conflict',
        reason: 'contract-already-associated-to-different-page',
      });
    });
    const report = await service.execute(
      createExecutionInput({
        plan: createPlan([createReadyAdoptEntry()]),
        existingPages: [{ id: 42, customPermalink: '/shop' }],
        associationSnapshot: {},
        persistAssociation,
      }),
    );

    expect(report.entries[0]).toEqual(
      expect.objectContaining({
        canonicalKey: 'org.fromcode:ecommerce:store-index',
        executionOutcome: 'failed',
        matchedPageId: 42,
        reasons: ['matched-by-customPermalink', 'contract-already-associated-to-different-page'],
      }),
    );
    expect(report.summary.byOutcome).toEqual({ applied: 0, failed: 1, noop: 0, skipped: 0 });
    expect(persistAssociation).toHaveBeenCalledTimes(1);
    expect(persistAssociation).toHaveBeenCalledWith({
      canonicalKey: 'org.fromcode:ecommerce:store-index',
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
        executionOutcome: 'failed',
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
        executionOutcome: 'failed',
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
        existingPages: [{ id: 42, customPermalink: '/shop' }],
        associationSnapshot: {
          byCanonicalKey: {
            'org.fromcode:ecommerce:store-index': {
              canonicalKey: 'org.fromcode:ecommerce:store-index',
              pageId: 10,
            },
          },
        },
        persistAssociation,
      }),
    );

    expect(report.entries[0]).toEqual(
      expect.objectContaining({
        executionOutcome: 'failed',
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
        existingPages: [{ id: 42, customPermalink: '/shop' }],
        associationSnapshot: {
          byPageId: {
            '42': {
              canonicalKey: 'org.fromcode:forms:contact-page',
              pageId: 42,
            },
          },
        },
        persistAssociation,
      }),
    );

    expect(report.entries[0]).toEqual(
      expect.objectContaining({
        executionOutcome: 'failed',
        reasons: ['matched-by-customPermalink', 'matched-page-already-associated-to-different-contract'],
      }),
    );
    expect(persistAssociation).not.toHaveBeenCalled();
  });

  it('skips blocked and create-missing entries without writing', async () => {
    const persistAssociation = vi.fn();
    const report = await service.execute(
      createExecutionInput({
        plan: createPlan([
          createPlanEntry({
            canonicalKey: 'org.fromcode:ecommerce:create-missing',
            key: 'create-missing',
            action: 'create-missing',
            status: 'ready',
            reasons: ['no-existing-page-match'],
          }),
          createPlanEntry({
            canonicalKey: 'org.fromcode:ecommerce:blocked',
            key: 'blocked',
            action: 'blocked',
            status: 'blocked',
            reasons: ['install-disabled'],
          }),
        ]),
        existingPages: [{ id: 42, customPermalink: '/shop' }],
        associationSnapshot: {},
        persistAssociation,
      }),
    );

    expect(report.entries).toEqual([
      expect.objectContaining({ canonicalKey: 'org.fromcode:ecommerce:blocked', executionOutcome: 'skipped', reasons: ['install-disabled'] }),
      expect.objectContaining({ canonicalKey: 'org.fromcode:ecommerce:create-missing', executionOutcome: 'skipped', reasons: ['no-existing-page-match'] }),
    ]);
    expect(report.summary.byOutcome.skipped).toBe(2);
    expect(persistAssociation).not.toHaveBeenCalled();
  });

  it('returns deterministic canonical-key ordering and summary counts', async () => {
    const persistAssociation = vi.fn(async (input: PluginDefaultPageContractAssociationPersistInput) => {
      return createPersistResult({
        canonicalKey: input.canonicalKey,
        pageId: input.pageId,
        status: 'applied',
      });
    });
    const report = await service.execute(
      createExecutionInput({
        plan: createPlan([
          createPlanEntry({
            canonicalKey: 'org.fromcode:zeta:skipped',
            namespace: 'org.fromcode',
            pluginSlug: 'zeta',
            key: 'skipped',
            action: 'blocked',
            status: 'blocked',
            reasons: ['disabled'],
          }),
          createPlanEntry({
            canonicalKey: 'org.fromcode:alpha:existing',
            namespace: 'org.fromcode',
            pluginSlug: 'alpha',
            key: 'existing',
            matchedPageId: 10,
            reasons: ['matched-by-customPermalink'],
          }),
          createPlanEntry({
            canonicalKey: 'org.fromcode:beta:missing-page',
            namespace: 'org.fromcode',
            pluginSlug: 'beta',
            key: 'missing-page',
            matchedPageId: 77,
            reasons: ['matched-by-customPermalink'],
          }),
        ]),
        existingPages: [{ id: 10, customPermalink: '/shop' }],
        associationSnapshot: {},
        persistAssociation,
      }),
    );

    expect(report.entries.map((entry) => entry.canonicalKey)).toEqual([
      'org.fromcode:alpha:existing',
      'org.fromcode:beta:missing-page',
      'org.fromcode:zeta:skipped',
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
  plan: PluginDefaultPageContractMaterializationPlan;
  existingPages: PluginDefaultPageContractPageSnapshot[];
  associationSnapshot: PluginDefaultPageContractBackfillAssociationSnapshot;
  persistAssociation?: (input: PluginDefaultPageContractAssociationPersistInput) => Promise<PluginDefaultPageContractAssociationPersistResult>;
}): PluginDefaultPageContractMaterializationExecutionInput {
  const pagesById = new Map(overrides.existingPages.map((page) => [String(page.id), page]));

  return {
    plan: overrides.plan,
    pageLookupRepository: {
      async findPageById(pageId: number | string): Promise<PluginDefaultPageContractPageSnapshot | undefined> {
        return pagesById.get(String(pageId));
      },
    },
    associationSnapshotRepository: {
      async getAssociationSnapshot(): Promise<PluginDefaultPageContractBackfillAssociationSnapshot> {
        return overrides.associationSnapshot;
      },
    },
    associationPersistRepository: {
      async persistAssociation(
        input: PluginDefaultPageContractAssociationPersistInput,
      ): Promise<PluginDefaultPageContractAssociationPersistResult> {
        if (overrides.persistAssociation) {
          return overrides.persistAssociation(input);
        }

        return createPersistResult({
          canonicalKey: input.canonicalKey,
          pageId: input.pageId,
          status: 'applied',
        });
      },
    },
  };
}

function createPlan(entries: PluginDefaultPageContractMaterializationPlanEntry[]): PluginDefaultPageContractMaterializationPlan {
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

function createReadyAdoptEntry(overrides: Partial<PluginDefaultPageContractMaterializationPlanEntry> = {}): PluginDefaultPageContractMaterializationPlanEntry {
  return createPlanEntry({
    matchedPageId: 42,
    reasons: ['matched-by-customPermalink'],
    ...overrides,
  });
}

function createPlanEntry(overrides: Partial<PluginDefaultPageContractMaterializationPlanEntry> = {}): PluginDefaultPageContractMaterializationPlanEntry {
  return {
    canonicalKey: 'org.fromcode:ecommerce:store-index',
    namespace: 'org.fromcode',
    pluginSlug: 'ecommerce',
    key: 'store-index',
    action: 'adopt-existing',
    lookupCandidates: ['/shop'],
    matchedPageId: undefined,
    createPayload: undefined,
    reasons: [],
    materializationMode: 'singleton-document',
    status: 'ready',
    ...overrides,
  };
}

function createPersistResult(
  overrides: Partial<PluginDefaultPageContractAssociationPersistResult>,
): PluginDefaultPageContractAssociationPersistResult {
  return {
    canonicalKey: 'org.fromcode:ecommerce:store-index',
    pageId: 42,
    status: 'applied',
    ...overrides,
  };
}