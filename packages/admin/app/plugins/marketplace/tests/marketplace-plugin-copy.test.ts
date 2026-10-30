import { describe, expect, it } from 'vitest';
import { MarketplacePluginCopy } from '@/app/plugins/marketplace/marketplace-plugin-copy';

/** The store showed "Finance Core" while Installed showed the same plugin as "Финанси". */
describe('MarketplacePluginCopy', () => {
  const entry = { name: 'Finance Core', description: 'Wallets, gift cards and the ledger.' };

  it("uses the installed plugin's words, which the api worded in the console's language", () => {
    const installed = { manifest: { name: 'Финанси', description: 'Портфейли, ваучери и регистър.' } };
    expect(MarketplacePluginCopy.label(entry, installed)).toBe('Финанси');
    expect(MarketplacePluginCopy.description(entry, installed)).toBe('Портфейли, ваучери и регистър.');
  });

  it("keeps the catalog's words for a plugin not installed here", () => {
    expect(MarketplacePluginCopy.label(entry, undefined)).toBe('Finance Core');
    expect(MarketplacePluginCopy.description(entry, null)).toBe('Wallets, gift cards and the ledger.');
  });
});
