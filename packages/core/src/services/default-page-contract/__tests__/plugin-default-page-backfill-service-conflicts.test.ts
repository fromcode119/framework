import { beforeEach, describe, expect, it } from 'vitest';
import type { ResolvedPluginDefaultPageContract } from '../../../types';
import { PluginDefaultPageBackfillService } from '../plugin-default-page-backfill-service';
import { SeedPageService } from '../../seed-page-service';

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

    expect(entry.action).toBe('ambiguous');
    expect(entry.status).toBe('ambiguous');
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
          kind: 'form-page',
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
        action: 'ambiguous',
        status: 'ambiguous',
        matchedPageId: 42,
        reasons: ['matched-by-customPermalink', 'page-claimed-by-multiple-contracts'],
      }),
      expect.objectContaining({
        canonicalKey: CONTACT_CANONICAL_KEY,
        action: 'ambiguous',
        status: 'ambiguous',
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

    expect(entry.action).toBe('ambiguous');
    expect(entry.status).toBe('ambiguous');
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

    expect(entry.action).toBe('ambiguous');
    expect(entry.status).toBe('ambiguous');
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
          kind: 'form-page',
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
        action: 'ambiguous',
        status: 'ambiguous',
        matchedPageId: 42,
        existingAssociationPageId: 42,
        reasons: ['matched-by-customPermalink', 'conflicting-association-snapshot'],
      }),
      expect.objectContaining({
        canonicalKey: CONTACT_CANONICAL_KEY,
        action: 'ambiguous',
        status: 'ambiguous',
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

    expect(entry.action).toBe('ambiguous');
    expect(entry.status).toBe('ambiguous');
    expect(entry.matchedPageId).toBe(10);
    expect(entry.existingAssociationPageId).toBe(10);
    expect(entry.reasons).toEqual(['matched-by-customPermalink', 'conflicting-association-snapshot']);
  });
});

function createResolvedContract(overrides: Partial<ResolvedPluginDefaultPageContract> = {}): ResolvedPluginDefaultPageContract {
  return {
    key: 'catalog-index',
    kind: 'index',
    defaultSlug: '/catalog',
    capability: 'catalog',
    recipe: 'catalog-module.catalog-index',
    materializationMode: 'singleton-document',
    dependencies: ['search'],
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
      siteStateMatch: 'none',
    },
    reasons: [],
    sources: {
      effectiveAliases: 'declaration',
      effectiveRecipe: 'declaration',
      effectiveSlug: 'declaration',
      effectiveStyleVariant: 'declaration',
      effectiveThemeLayout: 'declaration',
      effectiveTitle: 'declaration',
      install: 'declaration',
      prerequisiteReady: 'declaration',
      status: 'declaration',
    },
    status: 'ready',
    ...overrides,
  };
}