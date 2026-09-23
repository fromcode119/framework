import { describe, it, expect } from 'vitest';
import { DistinctiveNameScan } from '../src/distinctive-name-scan';

/**
 * The denied names themselves cannot appear here — that is the rule this guard enforces — so these pin
 * the two halves that decide whether a denied name is FOUND: which words a line yields, and the hash
 * they are compared by. The guard end to end is proven by planting a name and watching it fail.
 */
describe('DistinctiveNameScan', () => {
  it('yields every contiguous run of a hyphenated slug, so a name is found inside a longer one', () => {
    expect(DistinctiveNameScan.candidates('plugins/delta-shipping-adapter')).toEqual(expect.arrayContaining([
      'plugins', 'delta', 'shipping', 'adapter', 'delta-shipping', 'shipping-adapter', 'delta-shipping-adapter',
    ]));
  });

  it('splits camelCase and PascalCase, so a name is found at the front of an identifier', () => {
    expect(DistinctiveNameScan.candidates('const AcmeClientFixture = acmeRecord;')).toEqual(expect.arrayContaining([
      'acme', 'client', 'fixture', 'record',
    ]));
    expect(DistinctiveNameScan.candidates("toKey('ACME')")).toContain('acme');
  });

  it('splits on underscores and dots, which a word-boundary grep treats as part of the word', () => {
    expect(DistinctiveNameScan.candidates('realtime:acme_commission_earned www.acme.example')).toEqual(expect.arrayContaining([
      'acme', 'commission', 'earned', 'www', 'example',
    ]));
  });

  it('keeps a trailing number with its word as well as on its own', () => {
    expect(DistinctiveNameScan.candidates("tenant: 'example88'")).toEqual(expect.arrayContaining(['example88', 'example', '88']));
  });

  it('hashes case-insensitively and trims, so the printed entry matches however the name is written', () => {
    expect(DistinctiveNameScan.hash(' Acme ')).toBe(DistinctiveNameScan.hash('acme'));
    expect(DistinctiveNameScan.hash('acme')).toMatch(/^[0-9a-f]{16}$/);
  });

  it('does not fire on the ordinary words the framework uses for its own features', () => {
    const scan = new DistinctiveNameScan();
    expect(scan.match('// search the marketplace hub for forms and privacy settings')).toBeNull();
    expect(scan.match("const catalog = namespace('org.x').ledger;")).toBeNull();
  });
});
