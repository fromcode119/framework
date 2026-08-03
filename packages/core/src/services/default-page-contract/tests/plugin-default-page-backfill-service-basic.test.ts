import { beforeEach, describe, expect, it } from 'vitest';
import type { IPluginDefaultPageContractBackfillAssociationSnapshot } from '@core/default-page-contract/interfaces/plugin-default-page-contract-backfill-association-snapshot.interface';
import type { IPluginDefaultPageContractBackfillPageSnapshot } from '@core/default-page-contract/interfaces/plugin-default-page-contract-backfill-page-snapshot.interface';
import type { IResolvedPluginDefaultPageContract } from '@core/default-page-contract/interfaces/resolved-plugin-default-page-contract.interface';
import { PluginDefaultPageBackfillService } from '@core/services/default-page-contract/plugin-default-page-backfill-service';
import { SeedPageService } from '@core/services/seed-page-service';
import { PluginDefaultPageContractBackfillStatus } from '@core/default-page-contract/enums/plugin-default-page-contract-backfill-status.enum';
import { PluginDefaultPageContractBackfillAction } from '@core/default-page-contract/enums/plugin-default-page-contract-backfill-action.enum';
import { PluginDefaultPageContractMaterializationMode } from '@core/default-page-contract/enums/plugin-default-page-contract-materialization-mode.enum';
import { PluginDefaultPageContractSiteStateMatch } from '@core/default-page-contract/enums/plugin-default-page-contract-site-state-match.enum';
import { PluginDefaultPageContractKind } from '@core/default-page-contract/enums/plugin-default-page-contract-kind.enum';
import { PluginDefaultPageContractResolutionStatus } from '@core/default-page-contract/enums/plugin-default-page-contract-resolution-status.enum';
import { PluginDefaultPageContractDependency } from '@core/default-page-contract/enums/plugin-default-page-contract-dependency.enum';
import { PluginDefaultPageContractResolutionSource } from '@core/default-page-contract/enums/plugin-default-page-contract-resolution-source.enum';

const TEST_NAMESPACE = 'org.synthetic';
const CATALOG_CANONICAL_KEY = 'org.synthetic:catalog-module:catalog-index';
const POLICY_CANONICAL_KEY = 'org.synthetic:policy-module:primary-policy-page';

describe('PluginDefaultPageBackfillService basic planning', () => {
  let service: PluginDefaultPageBackfillService;

  beforeEach(() => {
    service = new PluginDefaultPageBackfillService(new SeedPageService());
  });

  it('returns entries in deterministic canonical key order', () => {
    const plan = service.createPlan({
      resolvedContracts: [
        createResolvedContract({
          canonicalKey: POLICY_CANONICAL_KEY,
          pluginSlug: 'policy-module',
          key: 'primary-policy-page',
          effectiveSlug: '/primary-policy',
        }),
        createResolvedContract(),
      ],
      existingPages: [],
      existingAssociations: {},
    });

    expect(plan.entries.map((entry) => entry.canonicalKey)).toEqual([
      CATALOG_CANONICAL_KEY,
      POLICY_CANONICAL_KEY,
    ]);
    expect(plan.summary.total).toBe(2);
  });

  it('marks a contract already-associated when its association points to a page in the snapshot', () => {
    const [entry] = service.createPlan({
      resolvedContracts: [createResolvedContract()],
      existingPages: [{ id: 42, customPermalink: '/shop' }],
      existingAssociations: {
        byCanonicalKey: {
          [CATALOG_CANONICAL_KEY]: {
            canonicalKey: CATALOG_CANONICAL_KEY,
            pageId: 42,
          },
        },
      },
    }).entries;

    expect(entry.action).toBe(PluginDefaultPageContractBackfillAction.ALREADY_ASSOCIATED);
    expect(entry.status).toBe(PluginDefaultPageContractBackfillStatus.ALREADY_ASSOCIATED);
    expect(entry.matchedPageId).toBeUndefined();
    expect(entry.existingAssociationPageId).toBe(42);
  });

  it('associates a single eligible existing page when there is no conflicting association', () => {
    const [entry] = service.createPlan({
      resolvedContracts: [createResolvedContract()],
      existingPages: [{ id: 7, customPermalink: '/catalog/' }],
      existingAssociations: {},
    }).entries;

    expect(entry.action).toBe(PluginDefaultPageContractBackfillAction.ASSOCIATE_EXISTING);
    expect(entry.status).toBe(PluginDefaultPageContractBackfillStatus.SAFE_TO_ASSOCIATE);
    expect(entry.matchedPageId).toBe(7);
    expect(entry.reasons).toEqual(['matched-by-customPermalink']);
  });

  it('propagates skipped and blocked resolved contracts without proposing associations', () => {
    const plan = service.createPlan({
      resolvedContracts: [
        createResolvedContract({
          canonicalKey: 'org.synthetic:contact-module:contact-page',
          pluginSlug: 'contact-module',
          key: 'contact-page',
          kind: PluginDefaultPageContractKind.FORM_PAGE,
          effectiveSlug: '/contact',
          effectiveAliases: [],
          status: PluginDefaultPageContractResolutionStatus.SKIPPED,
          reasons: ['install-disabled'],
        }),
        createResolvedContract({
          canonicalKey: 'org.synthetic:policy-module:secondary-policy-page',
          pluginSlug: 'policy-module',
          key: 'secondary-policy-page',
          kind: PluginDefaultPageContractKind.POLICY,
          effectiveSlug: '/secondary-policy',
          effectiveAliases: [],
          status: PluginDefaultPageContractResolutionStatus.BLOCKED,
          reasons: ['compliance-disabled'],
        }),
      ],
      existingPages: [{ id: 99, customPermalink: '/contact' }],
      existingAssociations: {},
    });

    expect(plan.entries).toEqual([
      expect.objectContaining({ action: PluginDefaultPageContractBackfillAction.SKIPPED, status: PluginDefaultPageContractBackfillStatus.SKIPPED, reasons: ['install-disabled'] }),
      expect.objectContaining({ action: PluginDefaultPageContractBackfillAction.BLOCKED, status: PluginDefaultPageContractBackfillStatus.BLOCKED, reasons: ['compliance-disabled'] }),
    ]);
  });

  it('defers per-record-document contracts', () => {
    const [entry] = service.createPlan({
      resolvedContracts: [
        createResolvedContract({
          canonicalKey: 'org.synthetic:learning-module:course-detail',
          pluginSlug: 'learning-module',
          key: 'course-detail',
          kind: PluginDefaultPageContractKind.DETAIL,
          effectiveSlug: '/courses',
          effectiveAliases: [],
          materializationMode: PluginDefaultPageContractMaterializationMode.PER_RECORD_DOCUMENT,
        }),
      ],
      existingPages: [{ id: 3, customPermalink: '/courses' }],
      existingAssociations: {},
    }).entries;

    expect(entry.action).toBe(PluginDefaultPageContractBackfillAction.DEFERRED);
    expect(entry.status).toBe(PluginDefaultPageContractBackfillStatus.DEFERRED);
    expect(entry.matchedPageId).toBeUndefined();
  });

  it('does not mutate resolved contracts, existing pages, or association snapshots', () => {
    const resolvedContracts = [createResolvedContract()];
    const existingPages: IPluginDefaultPageContractBackfillPageSnapshot[] = [
      { id: 5, slug: 'catalog', customPermalink: '/catalog' },
    ];
    const existingAssociations: IPluginDefaultPageContractBackfillAssociationSnapshot = {
      byCanonicalKey: {
        [CATALOG_CANONICAL_KEY]: {
          pageId: 5,
        },
      },
    };
    const plan = service.createPlan({ resolvedContracts, existingPages, existingAssociations });

    plan.entries[0].lookupCandidates.push('/mutated');
    plan.entries[0].reasons.push('mutated');

    expect(resolvedContracts).toEqual([createResolvedContract()]);
    expect(existingPages).toEqual([{ id: 5, slug: 'catalog', customPermalink: '/catalog' }]);
    expect(existingAssociations).toEqual({
      byCanonicalKey: {
        [CATALOG_CANONICAL_KEY]: {
          pageId: 5,
        },
      },
    });
  });

  it('produces stable summary counts for actions and statuses', () => {
    const plan = service.createPlan({
      resolvedContracts: [
        createResolvedContract({ canonicalKey: 'org.synthetic:catalog-module:page-a', key: 'page-a', effectiveSlug: '/a', adoptionHints: ['/a'] }),
        createResolvedContract({ canonicalKey: 'org.synthetic:catalog-module:page-b', key: 'page-b', effectiveSlug: '/b', adoptionHints: ['/b'], status: PluginDefaultPageContractResolutionStatus.SKIPPED, reasons: ['install-disabled'] }),
        createResolvedContract({ canonicalKey: 'org.synthetic:catalog-module:page-c', key: 'page-c', effectiveSlug: '/c', adoptionHints: ['/c'], materializationMode: PluginDefaultPageContractMaterializationMode.ADOPT_ONLY }),
        createResolvedContract({ canonicalKey: 'org.synthetic:catalog-module:page-d', key: 'page-d', effectiveSlug: '/d', adoptionHints: ['/d'] }),
      ],
      existingPages: [
        { id: 1, customPermalink: '/d' },
        { id: 11, customPermalink: '/legacy-a' },
      ],
      existingAssociations: {
        byCanonicalKey: {
          'org.synthetic:catalog-module:page-a': {
            pageId: 11,
          },
        },
      },
    });

    expect(plan.summary).toEqual({
      total: 4,
      byAction: {
        'already-associated': 1,
        ambiguous: 0,
        'associate-existing': 1,
        blocked: 1,
        deferred: 0,
        skipped: 1,
      },
      byStatus: {
        'already-associated': 1,
        ambiguous: 0,
        blocked: 1,
        deferred: 0,
        'safe-to-associate': 1,
        skipped: 1,
      },
    });
  });
});

function createResolvedContract(overrides: Partial<IResolvedPluginDefaultPageContract> = {}): IResolvedPluginDefaultPageContract {
  return {
    key: 'catalog-index',
    kind: PluginDefaultPageContractKind.INDEX,
    defaultSlug: '/catalog',
    capability: 'catalog',
    recipe: 'catalog-module.catalog-index',
    materializationMode: PluginDefaultPageContractMaterializationMode.SINGLETON_DOCUMENT,
    dependencies: [PluginDefaultPageContractDependency.SEARCH],
    adoptionHints: ['/catalog'],
    aliases: ['/browse'],
    required: true,
    namespace: TEST_NAMESPACE,
    pluginSlug: 'catalog-module',
    canonicalKey: CATALOG_CANONICAL_KEY,
    effectiveAliases: ['/browse'],
    effectiveRecipe: 'catalog-module.catalog-index',
    effectiveSlug: '/catalog',
    effectiveThemeLayout: 'CatalogLayout',
    effectiveTitle: 'Catalog',
    install: true,
    prerequisiteReady: true,
    provenance: {
      overrideApplied: false,
      siteStateMatch: PluginDefaultPageContractSiteStateMatch.NONE,
    },
    reasons: [],
    sources: {
      effectiveAliases: PluginDefaultPageContractResolutionSource.DECLARATION,
      effectiveRecipe: PluginDefaultPageContractResolutionSource.DECLARATION,
      effectiveSlug: PluginDefaultPageContractResolutionSource.DECLARATION,
      effectiveStyleVariant: PluginDefaultPageContractResolutionSource.DECLARATION,
      effectiveThemeLayout: PluginDefaultPageContractResolutionSource.DECLARATION,
      effectiveTitle: PluginDefaultPageContractResolutionSource.DECLARATION,
      install: PluginDefaultPageContractResolutionSource.DECLARATION,
      prerequisiteReady: PluginDefaultPageContractResolutionSource.DECLARATION,
      status: PluginDefaultPageContractResolutionSource.DECLARATION,
    },
    status: PluginDefaultPageContractResolutionStatus.READY,
    ...overrides,
  };
}