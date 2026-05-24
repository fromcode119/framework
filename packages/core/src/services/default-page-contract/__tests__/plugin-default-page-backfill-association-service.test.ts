import { describe, expect, it } from 'vitest';
import { PluginDefaultPageBackfillAssociationService } from '../plugin-default-page-backfill-association-service';

const CATALOG_CANONICAL_KEY = 'org.synthetic:catalog-module:catalog-index';
const CONTACT_CANONICAL_KEY = 'org.synthetic:contact-module:contact-page';
const POLICY_CANONICAL_KEY = 'org.synthetic:policy-module:primary-policy-page';

describe('PluginDefaultPageBackfillAssociationService', () => {
  it('ignores malformed snapshot entries that do not resolve to both canonical key and page id', () => {
    const service = new PluginDefaultPageBackfillAssociationService();
    const maps = service.createMaps({
      byCanonicalKey: {
        [CATALOG_CANONICAL_KEY]: {
          pageId: ' 42 ',
        },
        [CONTACT_CANONICAL_KEY]: {
          canonicalKey: CONTACT_CANONICAL_KEY,
          pageId: '   ',
        },
        '': {
          pageId: 99,
        },
      },
      byPageId: {
        '   ': {
          canonicalKey: POLICY_CANONICAL_KEY,
        },
        '51': {
          canonicalKey: '   ',
        },
      },
    });

    expect(Array.from(maps.byCanonicalKey.entries())).toEqual([
      [
        CATALOG_CANONICAL_KEY,
        {
          canonicalKey: CATALOG_CANONICAL_KEY,
          pageId: '42',
        },
      ],
    ]);
    expect(Array.from(maps.byPageId.entries())).toEqual([
      [
        '42',
        {
          canonicalKey: CATALOG_CANONICAL_KEY,
          pageId: '42',
        },
      ],
    ]);
    expect(Array.from(maps.conflicts.canonicalKeys)).toEqual([]);
    expect(Array.from(maps.conflicts.pageIds)).toEqual([]);
  });

  it('flags canonical-key and page-id conflicts while keeping first-seen records stable', () => {
    const service = new PluginDefaultPageBackfillAssociationService();
    const maps = service.createMaps({
      byCanonicalKey: {
        [CATALOG_CANONICAL_KEY]: {
          canonicalKey: CATALOG_CANONICAL_KEY,
          pageId: 42,
        },
      },
      byPageId: {
        '42': {
          canonicalKey: CONTACT_CANONICAL_KEY,
          pageId: 42,
        },
        '99': {
          canonicalKey: CATALOG_CANONICAL_KEY,
          pageId: 99,
        },
      },
    });

    expect(Array.from(maps.byCanonicalKey.entries())).toEqual([
      [
        CATALOG_CANONICAL_KEY,
        {
          canonicalKey: CATALOG_CANONICAL_KEY,
          pageId: 42,
        },
      ],
      [
        CONTACT_CANONICAL_KEY,
        {
          canonicalKey: CONTACT_CANONICAL_KEY,
          pageId: 42,
        },
      ],
    ]);
    expect(Array.from(maps.byPageId.entries())).toEqual([
      [
        '42',
        {
          canonicalKey: CATALOG_CANONICAL_KEY,
          pageId: 42,
        },
      ],
      [
        '99',
        {
          canonicalKey: CATALOG_CANONICAL_KEY,
          pageId: 99,
        },
      ],
    ]);
    expect(Array.from(maps.conflicts.canonicalKeys).sort()).toEqual([
      CATALOG_CANONICAL_KEY,
      CONTACT_CANONICAL_KEY,
    ]);
    expect(Array.from(maps.conflicts.pageIds).sort()).toEqual(['42', '99']);
  });
});