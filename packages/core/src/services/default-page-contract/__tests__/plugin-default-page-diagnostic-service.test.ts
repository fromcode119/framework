import { beforeEach, describe, expect, it } from 'vitest';
import type {
  PluginDefaultPageContractDiagnosticInput,
  PluginDefaultPageContractRegistration,
} from '../../../types';
import { PluginDefaultPageBackfillService } from '../plugin-default-page-backfill-service';
import { PluginDefaultPageContractRegistryService } from '../plugin-default-page-contract-registry-service';
import { PluginDefaultPageContractResolutionService } from '../plugin-default-page-contract-resolution-service';
import { PluginDefaultPageDiagnosticService } from '../plugin-default-page-diagnostic-service';
import { PluginDefaultPageMaterializationService } from '../plugin-default-page-materialization-service';
import { SeedPageService } from '../../seed-page-service';

const TEST_NAMESPACE = 'org.synthetic';
const TEST_PLUGIN = 'catalog-module';
const TEST_KEY = 'catalog-index';
const TEST_CANONICAL_KEY = 'org.synthetic:catalog-module:catalog-index';

describe('PluginDefaultPageDiagnosticService', () => {
  let registry: PluginDefaultPageContractRegistryService;
  let service: PluginDefaultPageDiagnosticService;

  beforeEach(() => {
    registry = new PluginDefaultPageContractRegistryService();

    service = new PluginDefaultPageDiagnosticService(
      new PluginDefaultPageContractResolutionService(registry),
      new PluginDefaultPageMaterializationService(new SeedPageService()),
      new PluginDefaultPageBackfillService(new SeedPageService()),
    );
  });

  it('returns resolution diagnostics when no planning snapshots are provided', () => {
    PluginDefaultPageDiagnosticServiceTestFixture.registerStoreIndex(registry);

    const report = service.createReport({
      resolution: {
        overrides: [
          {
            contract: {
              namespace: TEST_NAMESPACE,
              pluginSlug: TEST_PLUGIN,
              key: TEST_KEY,
            },
            slug: '/cosmic-box',
            aliases: ['/catalog'],
            title: 'Catalog',
            themeLayout: 'CatalogLayout',
          },
        ],
      },
    });

    expect(report.materializationPlan).toBeUndefined();
    expect(report.backfillPlan).toBeUndefined();
    expect(report.resolvedContracts).toEqual([
      expect.objectContaining({
        canonicalKey: TEST_CANONICAL_KEY,
        key: TEST_KEY,
        effectiveSlug: '/cosmic-box',
        effectiveAliases: ['/catalog'],
        status: 'ready',
        install: true,
        prerequisiteReady: true,
        reasons: [],
        sources: expect.objectContaining({
          effectiveSlug: 'theme-override',
        }),
        provenance: expect.objectContaining({
          overrideApplied: true,
        }),
      }),
    ]);
    expect(report.summary).toEqual({
      resolvedContracts: {
        total: 1,
        byStatus: {
          blocked: 0,
          ready: 1,
          skipped: 0,
        },
        installEnabled: 1,
        installDisabled: 0,
        prerequisiteReady: 1,
        prerequisiteBlocked: 0,
        overridesApplied: 1,
      },
      materializationPlan: undefined,
      backfillPlan: undefined,
    });
  });

  it('includes a materialization plan only when materialization pages are provided', () => {
    PluginDefaultPageDiagnosticServiceTestFixture.registerStoreIndex(registry);

    const withoutPages = service.createReport({
      materialization: {},
    });

    const withPages = service.createReport({
      materialization: {
        existingPages: [{ id: 42, customPermalink: '/catalog' }],
      },
    });

    expect(withoutPages.materializationPlan).toBeUndefined();
    expect(withPages.materializationPlan).toEqual(
      expect.objectContaining({
        entries: [
          expect.objectContaining({
            canonicalKey: TEST_CANONICAL_KEY,
            action: 'adopt-existing',
            matchedPageId: 42,
          }),
        ],
      }),
    );
    expect(withPages.backfillPlan).toBeUndefined();
    expect(withPages.summary.materializationPlan).toEqual(withPages.materializationPlan?.summary);
  });

  it('includes a backfill plan only when both page and association snapshots are provided', () => {
    PluginDefaultPageDiagnosticServiceTestFixture.registerStoreIndex(registry);

    const withoutAssociations = service.createReport({
      backfill: {
        existingPages: [{ id: 7, customPermalink: '/catalog' }],
      },
    });

    const withAssociations = service.createReport({
      backfill: {
        existingPages: [{ id: 7, customPermalink: '/catalog' }],
        existingAssociations: {},
      },
    });

    expect(withoutAssociations.backfillPlan).toBeUndefined();
    expect(withAssociations.backfillPlan).toEqual(
      expect.objectContaining({
        entries: [
          expect.objectContaining({
            canonicalKey: TEST_CANONICAL_KEY,
            action: 'associate-existing',
            matchedPageId: 7,
          }),
        ],
      }),
    );
    expect(withAssociations.materializationPlan).toBeUndefined();
    expect(withAssociations.summary.backfillPlan).toEqual(withAssociations.backfillPlan?.summary);
  });

  it('composes materialization and backfill plans independently from the same resolved contracts', () => {
    PluginDefaultPageDiagnosticServiceTestFixture.registerStoreIndex(registry);

    const report = service.createReport({
      materialization: {
        existingPages: [{ id: 10, customPermalink: '/catalog' }],
      },
      backfill: {
        existingPages: [{ id: 20, customPermalink: '/catalog' }],
        existingAssociations: {},
      },
    });

    expect(report.materializationPlan?.entries).toEqual([
      expect.objectContaining({
        canonicalKey: TEST_CANONICAL_KEY,
        action: 'adopt-existing',
        matchedPageId: 10,
      }),
    ]);
    expect(report.backfillPlan?.entries).toEqual([
      expect.objectContaining({
        canonicalKey: TEST_CANONICAL_KEY,
        action: 'associate-existing',
        matchedPageId: 20,
      }),
    ]);
    expect(report.summary.materializationPlan).toEqual(report.materializationPlan?.summary);
    expect(report.summary.backfillPlan).toEqual(report.backfillPlan?.summary);
  });

  it('does not mutate the provided diagnostic input object', () => {
    PluginDefaultPageDiagnosticServiceTestFixture.registerStoreIndex(registry);

    const input: PluginDefaultPageContractDiagnosticInput = {
      resolution: {
        overrides: [
          {
            contract: {
              namespace: TEST_NAMESPACE,
              pluginSlug: TEST_PLUGIN,
              key: TEST_KEY,
            },
            aliases: ['/browse'],
          },
        ],
        siteState: {
          byCapability: {
            catalog: {
              status: 'ready',
              reasons: ['catalog-ready'],
            },
          },
        },
      },
      materialization: {
        existingPages: [{ id: 5, customPermalink: '/catalog' }],
      },
      backfill: {
        existingPages: [{ id: 6, customPermalink: '/catalog' }],
        existingAssociations: {
          byCanonicalKey: {
            [TEST_CANONICAL_KEY]: {
              canonicalKey: TEST_CANONICAL_KEY,
              pageId: 6,
            },
          },
        },
      },
    };

    const original = PluginDefaultPageDiagnosticServiceTestFixture.cloneInput(input);
    const report = service.createReport(input);

    report.resolvedContracts[0].effectiveAliases.push('/mutated');
    report.materializationPlan?.entries[0].lookupCandidates.push('/mutated');
    report.backfillPlan?.entries[0].reasons.push('mutated');

    expect(input).toEqual(original);
  });
});

class PluginDefaultPageDiagnosticServiceTestFixture {
  static registerStoreIndex(registry: PluginDefaultPageContractRegistryService): void {
    registry.register(this.createStoreRegistration());
  }

  static cloneInput(input: PluginDefaultPageContractDiagnosticInput): PluginDefaultPageContractDiagnosticInput {
    return JSON.parse(JSON.stringify(input)) as PluginDefaultPageContractDiagnosticInput;
  }

  private static createStoreRegistration(): PluginDefaultPageContractRegistration {
    return {
      namespace: TEST_NAMESPACE,
      pluginSlug: TEST_PLUGIN,
      contracts: [
        {
          key: TEST_KEY,
          kind: 'index',
          defaultSlug: '/catalog',
          capability: 'catalog',
          recipe: 'catalog-module.catalog-index',
          materializationMode: 'singleton-document',
          dependencies: ['search'],
          adoptionHints: ['/catalog'],
          aliases: ['/browse'],
          required: true,
        },
      ],
    };
  }
}