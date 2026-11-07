import { describe, expect, it } from 'vitest';
import { CollectionFieldGuard } from '@api/controllers/collection-field-guard';

describe('CollectionFieldGuard', () => {
  it('treats read-only fields as overrideable by default', () => {
    const guard = new CollectionFieldGuard({} as any);

    expect(
      guard.isReadOnlyOverrideable({
        admin: {
          readOnly: true,
        },
      })
    ).toBe(true);
  });

  it('respects explicit read-only override opt-out flags', () => {
    const guard = new CollectionFieldGuard({} as any);

    expect(
      guard.isReadOnlyOverrideable({
        admin: {
          readOnly: true,
          readOnlyOverride: false,
        },
      })
    ).toBe(false);

    expect(
      guard.isReadOnlyOverrideable({
        admin: {
          readOnly: true,
          readOnlyOverride: 'never',
        },
      })
    ).toBe(false);

    expect(
      guard.isReadOnlyOverrideable({
        admin: {
          readOnly: true,
          allowReadOnlyOverride: false,
        },
      })
    ).toBe(false);
  });
  it('refuses a reserved root in a page address, but not in a field that says it is no page', () => {
    const guard = new CollectionFieldGuard({} as any);
    const page = { slug: 'pages', fields: [{ name: 'path', type: 'text' }] } as any;
    const source = { slug: 'sources', fields: [{ name: 'path', type: 'text', permalink: false }] } as any;

    expect(() => guard.assertPermalinkNotReserved(page, { path: '/plugins/zen-myself/favorites' })).toThrow(/reserved/);
    expect(() => guard.assertPermalinkNotReserved(source, { path: '/plugins/zen-myself/favorites' })).not.toThrow();
  });
});
