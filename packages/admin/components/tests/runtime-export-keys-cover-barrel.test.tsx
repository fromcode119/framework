import { describe, it, expect } from 'vitest';
import * as barrel from '@/components';
import { RuntimeConstants } from '@fromcode119/core/client';

/**
 * On a public page `@fromcode119/sdk/admin` is a stand-in module that declares only the names in
 * `RuntimeConstants.ADMIN_RUNTIME_EXPORT_KEYS`. A storefront bundle importing a name the admin exports but
 * the list does not name fails to load as a whole: cms's frontend.js imported `ColorField` and every site
 * lost its cms storefront script ("does not provide an export named 'ColorField'").
 */
describe('admin runtime export keys', () => {
  it('names every value the admin components barrel exports', () => {
    const listed = new Set<string>(RuntimeConstants.ADMIN_RUNTIME_EXPORT_KEYS as readonly string[]);
    expect(Object.keys(barrel).filter((key) => !listed.has(key)).sort()).toEqual([]);
  });
});
