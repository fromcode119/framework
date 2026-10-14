import { describe, expect, it } from 'vitest';
import { ChangelogNotes } from '@core/management/changelog-notes';

const CHANGELOG = `# Changelog

All notable changes, newest first.

## [0.2.391] - 2026-10-14

### Fixed

- **admin**: the plugin switch shows the platform's state at platform scope ([#929](https://github.com/fromcode119/framework/pull/929))

## [0.2.390] - 2026-10-14

### Added

- **api**: a full database pool names the sites and routes in it ([#927](https://github.com/fromcode119/framework/pull/927))

### Fixed

- **monitoring**: a site is reported down only after it fails twice in a row ([#927](https://github.com/fromcode119/framework/pull/927))

## [0.2.389] - 2026-10-13

### Fixed

- **core**: a plugin built on this installation installs from the console ([#925](https://github.com/fromcode119/framework/pull/925))
`;

/** The update screen showed "no notes were written" for every release since 0.2.162. */
describe('ChangelogNotes', () => {
  it('reads one version\'s section as plain text, links and bold folded away', () => {
    expect(ChangelogNotes.section(CHANGELOG, '0.2.391')).toBe(
      'Fixed\n\n- admin: the plugin switch shows the platform\'s state at platform scope (#929)',
    );
  });

  it('keeps every heading of a section with more than one, and stops at the next version', () => {
    const notes = ChangelogNotes.section(CHANGELOG, '0.2.390');

    expect(notes).toContain('Added\n\n- api: a full database pool names the sites and routes in it (#927)');
    expect(notes).toContain('Fixed\n\n- monitoring: a site is reported down only after it fails twice in a row (#927)');
    expect(notes).not.toContain('0.2.389');
    expect(notes).not.toContain('plugin built on this installation');
  });

  it('accepts the version with or without the leading v', () => {
    expect(ChangelogNotes.section(CHANGELOG, 'v0.2.389')).toContain('a plugin built on this installation installs from the console (#925)');
  });

  it('answers an empty string for a version the changelog does not mention', () => {
    expect(ChangelogNotes.section(CHANGELOG, '0.2.12')).toBe('');
    expect(ChangelogNotes.section('', '0.2.391')).toBe('');
  });

  it('does not mistake 0.2.39 for 0.2.391', () => {
    expect(ChangelogNotes.section(CHANGELOG, '0.2.39')).toBe('');
  });
});
