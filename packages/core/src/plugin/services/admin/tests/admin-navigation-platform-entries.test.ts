import { describe, expect, it } from 'vitest';
import { AdminSystemNavigationMetadataService } from '../admin-system-navigation-metadata-service';

/**
 * The settings entries that belong to the PLATFORM, asserted on the real metadata.
 *
 * `AdminNavigationScopeFilter` is tested against a fixture, so it proves the RULE works and nothing
 * about which entries actually carry the flag. Three did not: Infrastructure, Backups and Updates
 * each change the box every site runs on — maintenance mode and the isolation limits, a restore that
 * overwrites every customer's data, an update that replaces the framework and restarts it — and all
 * three sat in the settings sidebar of a console headed with one customer's name.
 *
 * The pages themselves now refuse inside a site, but hiding the entry is the other half: an operator
 * should not be offered a door that opens onto "wrong scope".
 */
const PLATFORM_SETTINGS = [
  'infrastructure',
  'backups',
  'updates',
  // The Sites panel: the registry of every site, and the two doors that add another one. `Sites`
  // itself carried the flag; its own sub-nav did not.
  'sites-list',
  'sites-new',
  'sites-import',
];

const settingsEntries = () => {
  const service = new AdminSystemNavigationMetadataService();
  // Each input wraps ONE panel item alongside the namespace it came from.
  return service.getSecondaryPanelInputs().map((input: any) => input.item);
};

describe('platform-owned settings entries', () => {
  it.each(PLATFORM_SETTINGS)('%s is withheld inside a site', (id) => {
    const entry = settingsEntries().find((item: any) => item?.id === id);

    expect(entry, `no settings entry with id "${id}"`).toBeDefined();
    expect(entry.platformScopeOnly).toBe(true);
  });

  it('does not withhold the per-site settings alongside them', () => {
    const entries = settingsEntries();
    // Localization is the control case: a site setting, and marked `siteOnly` for the opposite
    // reason. If a blanket edit ever flags the whole panel, this fails first.
    const localization = entries.find((item: any) => item?.id === 'localization');

    expect(localization).toBeDefined();
    expect(localization.platformScopeOnly).toBeUndefined();
  });
});
