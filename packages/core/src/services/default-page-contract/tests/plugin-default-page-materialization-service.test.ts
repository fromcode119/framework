import { beforeEach, describe, expect, it } from 'vitest';
import type { IPluginDefaultPageContractPageSnapshot } from '@core/default-page-contract/interfaces/plugin-default-page-contract-page-snapshot.interface';
import type { IResolvedPluginDefaultPageContract } from '@core/default-page-contract/interfaces/resolved-plugin-default-page-contract.interface';
import { PluginDefaultPageMaterializationService } from '@core/services/default-page-contract/plugin-default-page-materialization-service';
import { SeedPageService } from '@core/services/seed-page-service';
import { PluginDefaultPageContractMaterializationAction } from '@core/default-page-contract/enums/plugin-default-page-contract-materialization-action.enum';
import { PluginDefaultPageContractMaterializationStatus } from '@core/default-page-contract/enums/plugin-default-page-contract-materialization-status.enum';
import { PluginDefaultPageContractMaterializationMode } from '@core/default-page-contract/enums/plugin-default-page-contract-materialization-mode.enum';
import { PluginDefaultPageContractSiteStateMatch } from '@core/default-page-contract/enums/plugin-default-page-contract-site-state-match.enum';
import { PluginDefaultPageContractKind } from '@core/default-page-contract/enums/plugin-default-page-contract-kind.enum';
import { PluginDefaultPageContractResolutionStatus } from '@core/default-page-contract/enums/plugin-default-page-contract-resolution-status.enum';
import { PluginDefaultPageContractDependency } from '@core/default-page-contract/enums/plugin-default-page-contract-dependency.enum';
import { PluginDefaultPageContractResolutionSource } from '@core/default-page-contract/enums/plugin-default-page-contract-resolution-source.enum';

const TEST_NAMESPACE = 'org.synthetic';
const CATALOG_CANONICAL_KEY = 'org.synthetic:catalog-module:catalog-index';
const POLICY_CANONICAL_KEY = 'org.synthetic:policy-module:primary-policy-page';

describe('PluginDefaultPageMaterializationService', () => {
  let service: PluginDefaultPageMaterializationService;

  beforeEach(() => {
    service = new PluginDefaultPageMaterializationService(new SeedPageService());
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
    });

    expect(plan.entries.map((entry) => entry.canonicalKey)).toEqual([
      CATALOG_CANONICAL_KEY,
      POLICY_CANONICAL_KEY,
    ]);
    expect(plan.summary.total).toBe(2);
  });

  it('adopts an existing page on a unique custom permalink match', () => {
    const [entry] = service.createPlan({
      resolvedContracts: [createResolvedContract()],
      existingPages: [
        {
          id: 42,
          slug: 'catalog-home',
          customPermalink: '/catalog',
        },
      ],
    }).entries;

    expect(entry.action).toBe(PluginDefaultPageContractMaterializationAction.ADOPT_EXISTING);
    expect(entry.status).toBe(PluginDefaultPageContractMaterializationStatus.READY);
    expect(entry.matchedPageId).toBe(42);
    expect(entry.createPayload).toBeUndefined();
  });

  it('prefers custom permalink matches over slug-only matches', () => {
    const [entry] = service.createPlan({
      resolvedContracts: [createResolvedContract()],
      existingPages: [
        {
          id: 10,
          slug: 'catalog',
        },
        {
          id: 20,
          slug: 'different-slug',
          customPermalink: '/catalog',
        },
      ],
    }).entries;

    expect(entry.action).toBe(PluginDefaultPageContractMaterializationAction.ADOPT_EXISTING);
    expect(entry.matchedPageId).toBe(20);
  });

  it('treats trailing-slash permalink variants as equivalent during adoption matching', () => {
    const [entry] = service.createPlan({
      resolvedContracts: [createResolvedContract()],
      existingPages: [
        {
          id: 77,
          customPermalink: '/catalog/',
        },
      ],
    }).entries;

    expect(entry.action).toBe(PluginDefaultPageContractMaterializationAction.ADOPT_EXISTING);
    expect(entry.status).toBe(PluginDefaultPageContractMaterializationStatus.READY);
    expect(entry.matchedPageId).toBe(77);
  });

  it('creates missing payloads for ready singleton contracts with no match', () => {
    const [entry] = service.createPlan({
      resolvedContracts: [createResolvedContract()],
      existingPages: [],
    }).entries;

    expect(entry.action).toBe(PluginDefaultPageContractMaterializationAction.CREATE_MISSING);
    expect(entry.status).toBe(PluginDefaultPageContractMaterializationStatus.READY);
    expect(entry.createPayload).toEqual({
      canonicalKey: CATALOG_CANONICAL_KEY,
      namespace: TEST_NAMESPACE,
      pluginSlug: 'catalog-module',
      key: 'catalog-index',
      slug: 'catalog',
      customPermalink: '/catalog',
      aliases: ['/browse'],
      recipe: 'catalog-module.catalog-index',
      title: 'Catalog',
      themeLayout: 'CatalogLayout',
    });
  });

  it('offers the slug it would create as a lookup candidate for a nested route', () => {
    const [entry] = service.createPlan({
      resolvedContracts: [createResolvedContract({
        canonicalKey: 'org.synthetic:broadcast-module:newsletter-unsubscribe',
        pluginSlug: 'broadcast-module',
        key: 'newsletter-unsubscribe',
        effectiveSlug: '/newsletter/unsubscribe',
        aliases: [],
        effectiveAliases: [],
        adoptionHints: [],
      })],
      existingPages: [],
    }).entries;

    expect(entry.action).toBe(PluginDefaultPageContractMaterializationAction.CREATE_MISSING);
    expect(entry.createPayload?.slug).toBe('newsletter/unsubscribe');
    expect(entry.lookupCandidates).toContain(entry.createPayload?.slug);
  });

  it('adopts a page whose only identifying value is the slug the contract would create', () => {
    const [entry] = service.createPlan({
      resolvedContracts: [createResolvedContract({
        canonicalKey: 'org.synthetic:broadcast-module:newsletter-unsubscribe',
        pluginSlug: 'broadcast-module',
        key: 'newsletter-unsubscribe',
        effectiveSlug: '/newsletter/unsubscribe',
        aliases: [],
        effectiveAliases: [],
        adoptionHints: [],
      })],
      existingPages: [{ id: 54, slug: 'newsletter/unsubscribe' }],
    }).entries;

    expect(entry.action).toBe(PluginDefaultPageContractMaterializationAction.ADOPT_EXISTING);
    expect(entry.matchedPageId).toBe(54);
  });

  it('fails closed instead of creating two pages on one custom permalink', () => {
    const plan = service.createPlan({
      resolvedContracts: [
        createResolvedContract({ effectiveSlug: '/unsubscribe', aliases: [], effectiveAliases: [], adoptionHints: [] }),
        createResolvedContract({
          canonicalKey: 'org.synthetic:contact-module:contact-page',
          pluginSlug: 'contact-module',
          key: 'contact-page',
          effectiveSlug: '/unsubscribe',
          aliases: [],
          effectiveAliases: [],
          adoptionHints: [],
        }),
      ],
      existingPages: [],
    });

    expect(plan.entries).toEqual([
      expect.objectContaining({
        canonicalKey: CATALOG_CANONICAL_KEY,
        action: PluginDefaultPageContractMaterializationAction.AMBIGUOUS,
        status: PluginDefaultPageContractMaterializationStatus.AMBIGUOUS,
        createPayload: undefined,
        reasons: ['no-existing-page-match', 'custom-permalink-claimed-by-multiple-contracts'],
      }),
      expect.objectContaining({
        canonicalKey: 'org.synthetic:contact-module:contact-page',
        action: PluginDefaultPageContractMaterializationAction.AMBIGUOUS,
        status: PluginDefaultPageContractMaterializationStatus.AMBIGUOUS,
        createPayload: undefined,
        reasons: ['no-existing-page-match', 'custom-permalink-claimed-by-multiple-contracts'],
      }),
    ]);
    expect(plan.summary.byAction['create-missing']).toBe(0);
  });

  it('marks a contract ambiguous when multiple pages match the same best-priority candidates', () => {
    const [entry] = service.createPlan({
      resolvedContracts: [createResolvedContract()],
      existingPages: [
        { id: 1, customPermalink: '/catalog' },
        { id: 2, customPermalink: '/browse' },
      ],
    }).entries;

    expect(entry.action).toBe(PluginDefaultPageContractMaterializationAction.AMBIGUOUS);
    expect(entry.status).toBe(PluginDefaultPageContractMaterializationStatus.AMBIGUOUS);
    expect(entry.matchedPageId).toBeUndefined();
  });

  it('fails closed when multiple contracts claim the same existing page', () => {
    const plan = service.createPlan({
      resolvedContracts: [
        createResolvedContract(),
        createResolvedContract({
          canonicalKey: 'org.synthetic:contact-module:contact-page',
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
      existingPages: [
        {
          id: 42,
          customPermalink: '/catalog',
        },
      ],
    });

    expect(plan.entries).toEqual([
      expect.objectContaining({
        canonicalKey: CATALOG_CANONICAL_KEY,
        action: PluginDefaultPageContractMaterializationAction.AMBIGUOUS,
        status: PluginDefaultPageContractMaterializationStatus.AMBIGUOUS,
        matchedPageId: undefined,
        reasons: ['matched-by-customPermalink', 'matched-page-claimed-by-multiple-contracts'],
      }),
      expect.objectContaining({
        canonicalKey: 'org.synthetic:contact-module:contact-page',
        action: PluginDefaultPageContractMaterializationAction.AMBIGUOUS,
        status: PluginDefaultPageContractMaterializationStatus.AMBIGUOUS,
        matchedPageId: undefined,
        reasons: ['matched-by-customPermalink', 'matched-page-claimed-by-multiple-contracts'],
      }),
    ]);
    expect(plan.summary.byAction.ambiguous).toBe(2);
    expect(plan.summary.byStatus.ambiguous).toBe(2);
    expect(plan.summary.byAction['adopt-existing']).toBe(0);
  });

  it('propagates skipped and blocked resolved statuses without planning writes', () => {
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
    });

    expect(plan.entries).toEqual([
      expect.objectContaining({ action: PluginDefaultPageContractMaterializationAction.SKIP, status: PluginDefaultPageContractMaterializationStatus.SKIPPED, reasons: ['install-disabled'] }),
      expect.objectContaining({ action: PluginDefaultPageContractMaterializationAction.BLOCKED, status: PluginDefaultPageContractMaterializationStatus.BLOCKED, reasons: ['compliance-disabled'] }),
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
    }).entries;

    expect(entry.action).toBe(PluginDefaultPageContractMaterializationAction.DEFERRED);
    expect(entry.status).toBe(PluginDefaultPageContractMaterializationStatus.DEFERRED);
    expect(entry.createPayload).toBeUndefined();
  });

  /**
   * A nested route must derive a slug from its WHOLE path, not its last segment.
   *
   * Taking only the last segment made the slug a function of one word, so any two contracts ending in
   * the same word claimed the same page: `/reviews/unsubscribe` and `/newsletter/unsubscribe` both
   * produced `unsubscribe`, and the second plugin to register latched onto the first one's page. The
   * reconciliation failure that caused hard-failed cms and finance and cascaded to everything that
   * depends on them — from two plugins doing nothing more exotic than owning an unsubscribe page.
   *
   * It was already latent for mlm, whose `/partners/privacy` claimed the bare slug `privacy`.
   */
  it('derives a nested singleton slug as the whole path, so it matches the request path', () => {
    const [entry] = service.createPlan({
      resolvedContracts: [
        createResolvedContract({
          canonicalKey: 'org.synthetic:mailer:reviews-unsubscribe',
          pluginSlug: 'mailer',
          key: 'reviews-unsubscribe',
          effectiveSlug: '/reviews/unsubscribe',
        }),
      ],
      existingPages: [],
    }).entries;

    expect(entry.action).toBe(PluginDefaultPageContractMaterializationAction.CREATE_MISSING);
    expect(entry.createPayload?.slug).toBe('reviews/unsubscribe');
    expect(entry.createPayload?.customPermalink).toBe('/reviews/unsubscribe');
    // The router matches a request path against the slug, so the two must agree apart from the
    // leading slash. A hyphenated slug matches no path and the page 404s while looking healthy.
    expect(`/${entry.createPayload?.slug}`).toBe(entry.createPayload?.customPermalink);
  });

  it('gives two contracts ending in the same word distinct slugs', () => {
    const { entries } = service.createPlan({
      resolvedContracts: [
        createResolvedContract({
          canonicalKey: 'org.synthetic:a:reviews-unsubscribe',
          pluginSlug: 'a',
          key: 'reviews-unsubscribe',
          effectiveSlug: '/reviews/unsubscribe',
        }),
        createResolvedContract({
          canonicalKey: 'org.synthetic:b:newsletter-unsubscribe',
          pluginSlug: 'b',
          key: 'newsletter-unsubscribe',
          effectiveSlug: '/newsletter/unsubscribe',
        }),
      ],
      existingPages: [],
    });

    const slugs = entries.map((entry) => entry.createPayload?.slug);
    expect(slugs).toEqual(['reviews/unsubscribe', 'newsletter/unsubscribe']);
    expect(new Set(slugs).size).toBe(2);
  });

  /** Single-segment routes are the common case and must be untouched by the fix. */
  it('leaves a single-segment slug exactly as it was', () => {
    const [entry] = service.createPlan({
      resolvedContracts: [createResolvedContract()],
      existingPages: [],
    }).entries;

    expect(entry.createPayload?.slug).toBe('catalog');
  });

  it('defers parameterized singleton routes instead of planning literal placeholder pages', () => {
    const [entry] = service.createPlan({
      resolvedContracts: [
        createResolvedContract({
          canonicalKey: 'org.synthetic:catalog-module:catalog-detail',
          pluginSlug: 'catalog-module',
          key: 'catalog-detail',
          kind: PluginDefaultPageContractKind.DETAIL,
          effectiveSlug: '/catalog/:slug',
          effectiveAliases: ['/browse/:slug'],
          adoptionHints: ['/catalog/:slug'],
          recordCollection: 'catalog',
        }),
      ],
      existingPages: [{ id: 44, customPermalink: '/catalog/:slug' }],
    }).entries;

    expect(entry.action).toBe(PluginDefaultPageContractMaterializationAction.DEFERRED);
    expect(entry.status).toBe(PluginDefaultPageContractMaterializationStatus.DEFERRED);
    expect(entry.matchedPageId).toBeUndefined();
    expect(entry.createPayload).toBeUndefined();
    expect(entry.reasons).toEqual(['parameterized-route-deferred']);
  });

  it('never creates payloads for adopt-only contracts', () => {
    const [entry] = service.createPlan({
      resolvedContracts: [
        createResolvedContract({
          materializationMode: PluginDefaultPageContractMaterializationMode.ADOPT_ONLY,
        }),
      ],
      existingPages: [],
    }).entries;

    expect(entry.action).toBe(PluginDefaultPageContractMaterializationAction.BLOCKED);
    expect(entry.status).toBe(PluginDefaultPageContractMaterializationStatus.BLOCKED);
    expect(entry.createPayload).toBeUndefined();
    expect(entry.reasons).toEqual(['adopt-only-no-match']);
  });

  it('does not mutate resolved contract inputs or page snapshots', () => {
    const resolvedContracts = [createResolvedContract()];
    const existingPages: IPluginDefaultPageContractPageSnapshot[] = [
      {
        id: 5,
        slug: 'catalog',
        customPermalink: '/catalog',
      },
    ];
    const plan = service.createPlan({ resolvedContracts, existingPages });

    plan.entries[0].lookupCandidates.push('/mutated');
    plan.entries[0].reasons.push('mutated');
    plan.entries[0].createPayload?.aliases.push('/mutated');

    expect(resolvedContracts).toEqual([createResolvedContract()]);
    expect(existingPages).toEqual([
      {
        id: 5,
        slug: 'catalog',
        customPermalink: '/catalog',
      },
    ]);
  });

  it('produces stable summary counts for actions and statuses', () => {
    const plan = service.createPlan({
      resolvedContracts: [
        createResolvedContract({ canonicalKey: 'org.synthetic:catalog-module:page-a', key: 'page-a', effectiveSlug: '/a' }),
        createResolvedContract({ canonicalKey: 'org.synthetic:catalog-module:page-b', key: 'page-b', effectiveSlug: '/b', status: PluginDefaultPageContractResolutionStatus.SKIPPED, reasons: ['install-disabled'] }),
        createResolvedContract({ canonicalKey: 'org.synthetic:catalog-module:page-c', key: 'page-c', effectiveSlug: '/c', materializationMode: PluginDefaultPageContractMaterializationMode.ADOPT_ONLY }),
      ],
      existingPages: [{ id: 1, customPermalink: '/a' }],
    });

    expect(plan.summary).toEqual({
      total: 3,
      byAction: {
        'adopt-existing': 1,
        ambiguous: 0,
        blocked: 1,
        'create-missing': 0,
        deferred: 0,
        skip: 1,
      },
      byStatus: {
        ambiguous: 0,
        blocked: 1,
        deferred: 0,
        ready: 1,
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
    status: PluginDefaultPageContractMaterializationStatus.READY,
    ...overrides,
  };
}