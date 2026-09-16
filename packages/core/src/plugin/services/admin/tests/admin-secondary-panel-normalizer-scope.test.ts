import { describe, expect, it } from 'vitest';
import { AdminSecondaryPanelNormalizer } from '../admin-secondary-panel-normalizer';

/**
 * The scope flags must survive normalisation.
 *
 * `AdminNavigationScopeFilter` reads `siteOnly` and `platformScopeOnly` off each panel entry, but
 * the normaliser rebuilt every entry from an allow-list of fields and neither flag was on it. So the
 * filter only ever saw entries with no flags and kept all of them — both flags were dead on the
 * secondary panel no matter how an entry declared them. Localization and Appearance were offered in
 * the platform scope, where there is no site row to write; Infrastructure, Backups and Updates were
 * offered inside a site, where they change the box every other site runs on.
 *
 * The filter tests for `=== true`, so an absent flag must stay absent rather than become `false`.
 */
const input = (item: Record<string, unknown>) => ({
  sourceNamespace: 'org.fromcode',
  sourcePlugin: 'system',
  sourceCanonicalKey: 'org.fromcode:system',
  item,
}) as never;

const normalize = (item: Record<string, unknown>) => new AdminSecondaryPanelNormalizer().normalize(input(item));

describe('secondary panel normalisation', () => {
  it('carries platformScopeOnly through', () => {
    expect(normalize({ id: 'backups', label: 'Backups', path: '/settings/backups', platformScopeOnly: true }).platformScopeOnly).toBe(true);
  });

  it('carries siteOnly through', () => {
    expect(normalize({ id: 'localization', label: 'Localization', path: '/settings/localization', siteOnly: true }).siteOnly).toBe(true);
  });

  it('leaves an unflagged entry unflagged, not false', () => {
    const entry = normalize({ id: 'general', label: 'General', path: '/settings/general' });

    expect(entry.siteOnly).toBeUndefined();
    expect(entry.platformScopeOnly).toBeUndefined();
  });
});
