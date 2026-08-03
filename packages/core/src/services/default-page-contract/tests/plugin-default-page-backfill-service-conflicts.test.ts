import { beforeEach, describe, expect, it } from 'vitest';
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
const CONTACT_CANONICAL_KEY = 'org.synthetic:contact-module:contact-page';

describe('PluginDefaultPageBackfillService conflicts', () => {
  let service: PluginDefaultPageBackfillService;

  beforeEach(() => {
    service = new PluginDefaultPageBackfillService(new SeedPageService());
  });

  it('marks a contract ambiguous when multiple pages match the same singleton contract', () => {
    const [entry] = service.createPlan({
      resolvedContracts: [createResolvedContract()],
      existingPages: [
        { id: 1, customPermalink: '/catalog' },
        { id: 2, customPermalink: '/browse' },
      ],
      existingAssociations: {},
    }).entries;

    expect(entry.action).toBe(PluginDefaultPageContractBackfillAction.AMBIGUOUS);
    expect(entry.status).toBe(PluginDefaultPageContractBackfillStatus.AMBIGUOUS);
    expect(entry.matchedPageId).toBeUndefined();
    expect(entry.reasons).toEqual(['multiple-existing-pages-matched']);
  });

  it('marks both contracts ambiguous when they claim the same page in the plan', () => {
    const plan = service.createPlan({
      resolvedContracts: [
        createResolvedContract(),
        createResolvedContract({
          canonicalKey: CONTACT_CANONICAL_KEY,
          pluginSlug: 'contact-module',
          key: 'contact-page',
          kind: PluginDefaultPageContractKind.FORM_PAGE,
          capability: 'contact-form',
          recipe: 'contact-module.contact-page',
          effectiveRecipe: 'contact-module.contact-page',
          effectiveSlug: '/catalog',
          effectiveTitle: 'Contact',
          effectiveThemeLayout: 'DefaultLayout',
          aliases: [],
          effectiveAliases: [],
          adoptionHints: ['/catalog'],
        }),
      ],
      existingPages: [{ id: 42, customPermalink: '/catalog' }],
      existingAssociations: {},
    });

    expect(plan.entries).toEqual([
      expect.objectContaining({
        canonicalKey: CATALOG_CANONICAL_KEY,
        action: PluginDefaultPageContractBackfillAction.AMBIGUOUS,
        status: PluginDefaultPageContractBackfillStatus.AMBIGUOUS,
        matchedPageId: 42,
        reasons: ['matched-by-customPermalink', 'page-claimed-by-multiple-contracts'],
      }),
      expect.objectContaining({
        canonicalKey: CONTACT_CANONICAL_KEY,
        action: PluginDefaultPageContractBackfillAction.AMBIGUOUS,
        status: PluginDefaultPageContractBackfillStatus.AMBIGUOUS,
        matchedPageId: 42,
        reasons: ['matched-by-customPermalink', 'page-claimed-by-multiple-contracts'],
      }),
    ]);
  });

  it('marks a contract ambiguous when an existing association conflicts with a matched candidate', () => {
    const [entry] = service.createPlan({
      resolvedContracts: [createResolvedContract()],
      existingPages: [
        { id: 10, customPermalink: '/archived-catalog' },
        { id: 20, customPermalink: '/catalog' },
      ],
      existingAssociations: {
        byCanonicalKey: {
          [CATALOG_CANONICAL_KEY]: {
            pageId: 10,
          },
        },
      },
    }).entries;

    expect(entry.action).toBe(PluginDefaultPageContractBackfillAction.AMBIGUOUS);
    expect(entry.status).toBe(PluginDefaultPageContractBackfillStatus.AMBIGUOUS);
    expect(entry.matchedPageId).toBe(20);
    expect(entry.existingAssociationPageId).toBe(10);
    expect(entry.reasons).toEqual(['contract-already-associated-to-different-page', 'matched-by-customPermalink']);
  });

  it('marks a contract ambiguous when a matched page is already associated to a different contract', () => {
    const [entry] = service.createPlan({
      resolvedContracts: [createResolvedContract()],
      existingPages: [{ id: 22, customPermalink: '/catalog' }],
      existingAssociations: {
        byPageId: {
          '22': {
            canonicalKey: CONTACT_CANONICAL_KEY,
            pageId: 22,
          },
        },
      },
    }).entries;

    expect(entry.action).toBe(PluginDefaultPageContractBackfillAction.AMBIGUOUS);
    expect(entry.status).toBe(PluginDefaultPageContractBackfillStatus.AMBIGUOUS);
    expect(entry.matchedPageId).toBe(22);
    expect(entry.reasons).toEqual(['matched-by-customPermalink', 'matched-page-already-associated-to-different-contract']);
  });

  it('fails closed when the snapshot maps the same page id to different canonical keys', () => {
    const plan = service.createPlan({
      resolvedContracts: [
        createResolvedContract(),
        createResolvedContract({
          canonicalKey: CONTACT_CANONICAL_KEY,
          pluginSlug: 'contact-module',
          key: 'contact-page',
          kind: PluginDefaultPageContractKind.FORM_PAGE,
          capability: 'contact-form',
          recipe: 'contact-module.contact-page',
          effectiveRecipe: 'contact-module.contact-page',
          effectiveSlug: '/contact',
          effectiveTitle: 'Contact',
          effectiveThemeLayout: 'DefaultLayout',
          aliases: [],
          effectiveAliases: [],
          adoptionHints: ['/contact'],
        }),
      ],
      existingPages: [{ id: 42, customPermalink: '/catalog' }],
      existingAssociations: {
        byCanonicalKey: {
          [CATALOG_CANONICAL_KEY]: {
            canonicalKey: CATALOG_CANONICAL_KEY,
            pageId: 42,
          },
          [CONTACT_CANONICAL_KEY]: {
            canonicalKey: CONTACT_CANONICAL_KEY,
            pageId: 42,
          },
        },
        byPageId: {
          '42': {
            canonicalKey: CONTACT_CANONICAL_KEY,
            pageId: 42,
          },
        },
      },
    });

    expect(plan.entries).toEqual([
      expect.objectContaining({
        canonicalKey: CATALOG_CANONICAL_KEY,
        action: PluginDefaultPageContractBackfillAction.AMBIGUOUS,
        status: PluginDefaultPageContractBackfillStatus.AMBIGUOUS,
        matchedPageId: 42,
        existingAssociationPageId: 42,
        reasons: ['matched-by-customPermalink', 'conflicting-association-snapshot'],
      }),
      expect.objectContaining({
        canonicalKey: CONTACT_CANONICAL_KEY,
        action: PluginDefaultPageContractBackfillAction.AMBIGUOUS,
        status: PluginDefaultPageContractBackfillStatus.AMBIGUOUS,
        matchedPageId: undefined,
        existingAssociationPageId: 42,
        reasons: ['conflicting-association-snapshot'],
      }),
    ]);
    expect(plan.summary.byAction.ambiguous).toBe(2);
    expect(plan.summary.byStatus.ambiguous).toBe(2);
  });

  it('fails closed when the snapshot maps one canonical key to different page ids', () => {
    const [entry] = service.createPlan({
      resolvedContracts: [createResolvedContract()],
      existingPages: [
        { id: 10, customPermalink: '/catalog' },
        { id: 11, customPermalink: '/archived-catalog' },
      ],
      existingAssociations: {
        byCanonicalKey: {
          [CATALOG_CANONICAL_KEY]: {
            canonicalKey: CATALOG_CANONICAL_KEY,
            pageId: 10,
          },
        },
        byPageId: {
          '11': {
            canonicalKey: CATALOG_CANONICAL_KEY,
            pageId: 11,
          },
        },
      },
    }).entries;

    expect(entry.action).toBe(PluginDefaultPageContractBackfillAction.AMBIGUOUS);
    expect(entry.status).toBe(PluginDefaultPageContractBackfillStatus.AMBIGUOUS);
    expect(entry.matchedPageId).toBe(10);
    expect(entry.existingAssociationPageId).toBe(10);
    expect(entry.reasons).toEqual(['matched-by-customPermalink', 'conflicting-association-snapshot']);
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