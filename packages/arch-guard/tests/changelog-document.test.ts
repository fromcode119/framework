import { describe, expect, it } from 'vitest';
import { ChangelogDocument } from '../src/changelog/changelog-document';

/**
 * CHANGELOG.md is built from release tags and commit subjects. It stopped at a hand-written 2.0.0 while 299
 * tagged releases shipped beside it; these hold the shape of the rebuilt file and the check that keeps it current.
 */
describe('ChangelogDocument', () => {
  const doc = new ChangelogDocument('https://github.com/acme/framework');
  const release = {
    version: '0.2.242',
    date: '2026-09-28',
    subjects: [
      'feat(storefront): hide email addresses and phone numbers from harvesters (#492)',
      'fix(admin): the Security screen saves only what the operator changed (#494)',
      'perf: faster first paint (#10)',
      'feat(api)!: drop the v0 routes (#11)',
      'chore(release): 0.2.242 (#493)',
      'ci: cache npm (#12)',
      'refactor(core): split a service (#13)',
      'test: cover the edge (#14)',
      'Update README',
    ],
  };
  const rendered = doc.render([release], '');

  it('groups user-facing changes by type, with scope and PR link', () => {
    expect(rendered).toContain('## [0.2.242] - 2026-09-28');
    expect(rendered).toContain('### Added\n\n- **storefront**: hide email addresses and phone numbers from harvesters ([#492](https://github.com/acme/framework/pull/492))');
    expect(rendered).toContain('### Fixed\n\n- **admin**: the Security screen saves only what the operator changed ([#494](https://github.com/acme/framework/pull/494))');
    expect(rendered).toContain('### Performance\n\n- faster first paint ([#10](https://github.com/acme/framework/pull/10))');
    expect(rendered).toContain('- **BREAKING** **api**: drop the v0 routes');
    expect(rendered).toContain('### Changed\n\n- Update README');
  });

  it('leaves out what a user upgrading does not need to read', () => {
    for (const hidden of ['0.2.242 (#493)', 'cache npm', 'split a service', 'cover the edge']) {
      expect(rendered).not.toContain(hidden);
    }
  });

  it('says so when a release changed nothing user-facing, and leaves Unreleased undated', () => {
    const out = doc.render([
      { version: '0.1.0', date: '2026-01-01', subjects: ['chore: tidy'] },
      { version: ChangelogDocument.UNRELEASED, date: '', subjects: ['fix: x'] },
    ], '');
    expect(out).toContain('## [0.1.0] - 2026-01-01\n\n_No user-facing changes._');
    expect(out).toContain('## [Unreleased]\n');
    expect(out.indexOf('## [Unreleased]')).toBeLessThan(out.indexOf('## [0.1.0]'));
  });

  it('carries the hand-written history over, and keeps it identical on every rebuild', () => {
    const original = '# Changelog\n\nintro\n\n---\n\n## [2.0.0] - 2026-03-08\n\nhand-written notes\n';
    const first = doc.render([release], ChangelogDocument.legacyOf(original));
    expect(first).toContain(`${ChangelogDocument.LEGACY_MARKER}\n\n## [2.0.0] - 2026-03-08\n\nhand-written notes`);
    expect(doc.render([release], ChangelogDocument.legacyOf(first))).toBe(first);
  });

  it('knows whether a version has its section', () => {
    expect(ChangelogDocument.hasSection(rendered, '0.2.242')).toBe(true);
    expect(ChangelogDocument.hasSection(rendered, '0.2.243')).toBe(false);
  });
});
