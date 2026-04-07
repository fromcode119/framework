import { describe, expect, it } from 'vitest';
import { PluginDefaultPageBackfillAssociationService } from '../plugin-default-page-backfill-association-service';

describe('PluginDefaultPageBackfillAssociationService', () => {
  it('ignores malformed snapshot entries that do not resolve to both canonical key and page id', () => {
    const service = new PluginDefaultPageBackfillAssociationService();
    const maps = service.createMaps({
      byCanonicalKey: {
        'org.fromcode:ecommerce:store-index': {
          pageId: ' 42 ',
        },
        'org.fromcode:forms:contact-page': {
          canonicalKey: 'org.fromcode:forms:contact-page',
          pageId: '   ',
        },
        '': {
          pageId: 99,
        },
      },
      byPageId: {
        '   ': {
          canonicalKey: 'org.fromcode:privacy:privacy-policy-page',
        },
        '51': {
          canonicalKey: '   ',
        },
      },
    });

    expect(Array.from(maps.byCanonicalKey.entries())).toEqual([
      [
        'org.fromcode:ecommerce:store-index',
        {
          canonicalKey: 'org.fromcode:ecommerce:store-index',
          pageId: '42',
        },
      ],
    ]);
    expect(Array.from(maps.byPageId.entries())).toEqual([
      [
        '42',
        {
          canonicalKey: 'org.fromcode:ecommerce:store-index',
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
        'org.fromcode:ecommerce:store-index': {
          canonicalKey: 'org.fromcode:ecommerce:store-index',
          pageId: 42,
        },
      },
      byPageId: {
        '42': {
          canonicalKey: 'org.fromcode:forms:contact-page',
          pageId: 42,
        },
        '99': {
          canonicalKey: 'org.fromcode:ecommerce:store-index',
          pageId: 99,
        },
      },
    });

    expect(Array.from(maps.byCanonicalKey.entries())).toEqual([
      [
        'org.fromcode:ecommerce:store-index',
        {
          canonicalKey: 'org.fromcode:ecommerce:store-index',
          pageId: 42,
        },
      ],
      [
        'org.fromcode:forms:contact-page',
        {
          canonicalKey: 'org.fromcode:forms:contact-page',
          pageId: 42,
        },
      ],
    ]);
    expect(Array.from(maps.byPageId.entries())).toEqual([
      [
        '42',
        {
          canonicalKey: 'org.fromcode:ecommerce:store-index',
          pageId: 42,
        },
      ],
      [
        '99',
        {
          canonicalKey: 'org.fromcode:ecommerce:store-index',
          pageId: 99,
        },
      ],
    ]);
    expect(Array.from(maps.conflicts.canonicalKeys).sort()).toEqual([
      'org.fromcode:ecommerce:store-index',
      'org.fromcode:forms:contact-page',
    ]);
    expect(Array.from(maps.conflicts.pageIds).sort()).toEqual(['42', '99']);
  });
});