import { beforeEach, describe, expect, it } from 'vitest';
import type { ResolvedPluginDefaultPageContract } from '../../../types';
import { PluginDefaultPageBackfillService } from '../plugin-default-page-backfill-service';
import { SeedPageService } from '../../seed-page-service';

describe('PluginDefaultPageBackfillService conflicts', () => {
  let service: PluginDefaultPageBackfillService;

  beforeEach(() => {
    service = new PluginDefaultPageBackfillService(new SeedPageService());
  });

  it('marks a contract ambiguous when multiple pages match the same singleton contract', () => {
    const [entry] = service.createPlan({
      resolvedContracts: [createResolvedContract()],
      existingPages: [
        { id: 1, customPermalink: '/shop' },
        { id: 2, customPermalink: '/catalog' },
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
          canonicalKey: 'org.fromcode:forms:contact-page',
          pluginSlug: 'forms',
          key: 'contact-page',
          kind: 'form-page',
          capability: 'forms',
          recipe: 'forms.contact-page',
          effectiveRecipe: 'forms.contact-page',
          effectiveSlug: '/shop',
          effectiveTitle: 'Contact',
          effectiveThemeLayout: 'DefaultLayout',
          aliases: [],
          effectiveAliases: [],
          adoptionHints: ['/shop'],
        }),
      ],
      existingPages: [{ id: 42, customPermalink: '/shop' }],
      existingAssociations: {},
    });

    expect(plan.entries).toEqual([
      expect.objectContaining({
        canonicalKey: 'org.fromcode:ecommerce:store-index',
        action: 'ambiguous',
        status: 'ambiguous',
        matchedPageId: 42,
        reasons: ['matched-by-customPermalink', 'page-claimed-by-multiple-contracts'],
      }),
      expect.objectContaining({
        canonicalKey: 'org.fromcode:forms:contact-page',
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
        { id: 10, customPermalink: '/archived-shop' },
        { id: 20, customPermalink: '/shop' },
      ],
      existingAssociations: {
        byCanonicalKey: {
          'org.fromcode:ecommerce:store-index': {
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
      existingPages: [{ id: 22, customPermalink: '/shop' }],
      existingAssociations: {
        byPageId: {
          '22': {
            canonicalKey: 'org.fromcode:forms:contact-page',
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
          canonicalKey: 'org.fromcode:forms:contact-page',
          pluginSlug: 'forms',
          key: 'contact-page',
          kind: 'form-page',
          capability: 'forms',
          recipe: 'forms.contact-page',
          effectiveRecipe: 'forms.contact-page',
          effectiveSlug: '/contact',
          effectiveTitle: 'Contact',
          effectiveThemeLayout: 'DefaultLayout',
          aliases: [],
          effectiveAliases: [],
          adoptionHints: ['/contact'],
        }),
      ],
      existingPages: [{ id: 42, customPermalink: '/shop' }],
      existingAssociations: {
        byCanonicalKey: {
          'org.fromcode:ecommerce:store-index': {
            canonicalKey: 'org.fromcode:ecommerce:store-index',
            pageId: 42,
          },
          'org.fromcode:forms:contact-page': {
            canonicalKey: 'org.fromcode:forms:contact-page',
            pageId: 42,
          },
        },
        byPageId: {
          '42': {
            canonicalKey: 'org.fromcode:forms:contact-page',
            pageId: 42,
          },
        },
      },
    });

    expect(plan.entries).toEqual([
      expect.objectContaining({
        canonicalKey: 'org.fromcode:ecommerce:store-index',
        action: 'ambiguous',
        status: 'ambiguous',
        matchedPageId: 42,
        existingAssociationPageId: 42,
        reasons: ['matched-by-customPermalink', 'conflicting-association-snapshot'],
      }),
      expect.objectContaining({
        canonicalKey: 'org.fromcode:forms:contact-page',
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
        { id: 10, customPermalink: '/shop' },
        { id: 11, customPermalink: '/archived-shop' },
      ],
      existingAssociations: {
        byCanonicalKey: {
          'org.fromcode:ecommerce:store-index': {
            canonicalKey: 'org.fromcode:ecommerce:store-index',
            pageId: 10,
          },
        },
        byPageId: {
          '11': {
            canonicalKey: 'org.fromcode:ecommerce:store-index',
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
    key: 'store-index',
    kind: 'index',
    defaultSlug: '/shop',
    capability: 'catalog',
    recipe: 'ecommerce.store-index',
    materializationMode: 'singleton-document',
    dependencies: ['search'],
    adoptionHints: ['/shop'],
    aliases: ['/catalog'],
    required: true,
    namespace: 'org.fromcode',
    pluginSlug: 'ecommerce',
    canonicalKey: 'org.fromcode:ecommerce:store-index',
    effectiveAliases: ['/catalog'],
    effectiveRecipe: 'ecommerce.store-index',
    effectiveSlug: '/shop',
    effectiveThemeLayout: 'StoreLayout',
    effectiveTitle: 'Store',
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