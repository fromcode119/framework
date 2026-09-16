import { describe, expect, it } from 'vitest';
import { CatalogEntry } from '@core/marketplace/contributions/catalog-entry';

/**
 * A contributed entry must say it is contributed.
 *
 * The marketplace screens merge two lists that render identically: the configured catalogue, and
 * packages this installation built itself through Sources. In PLATFORM scope contributions ARE
 * offered, which is correct — it is the operator's own inventory — but the screen is headed
 * "Marketplace", so an operator connected to no marketplace saw a populated page and had no way to
 * tell where any of it came from. `source` is the only thing that distinguishes them downstream.
 */
describe('contributed catalogue entry origin', () => {
  const row = { slug: 'example', version: '1.0.0', kind: 'plugin', downloadUrl: 'https://build.local/x.zip', name: 'Example' };

  it('marks what this installation built as local', () => {
    expect(CatalogEntry.from(row)?.toCatalogPlugin()).toMatchObject({ source: 'local' });
  });

  it('still carries the fields the catalogue shape needs', () => {
    // The entry must otherwise travel through the same code as a remote one.
    expect(CatalogEntry.from(row)?.toCatalogPlugin()).toMatchObject({
      slug: 'example', name: 'Example', version: '1.0.0', kind: 'plugin',
    });
  });
});
