import { describe, expect, it } from 'vitest';
import { SourceUpdateSummary } from '@/app/sources/source-update-summary';

const update = (slug: string, type: string, hasUpdate: boolean) => ({ slug, type, hasUpdate, remoteSha: null });

describe('SourceUpdateSummary', () => {
  it('says so when nothing moved', () => {
    const summary = new SourceUpdateSummary({ total: 2, changed: 0, updates: [update('alpha', 'plugin', false), update('beta', 'plugin', false)] }, []);
    expect(summary.hasUpdates).toBe(false);
    expect(summary.title).toBe('Everything is up to date');
    expect(summary.message).toBe('All 2 sources match their tracked branch.');
  });

  it('does not say "All 1 sources"', () => {
    const summary = new SourceUpdateSummary({ total: 1, changed: 0, updates: [update('gamma', 'plugin', false)] }, []);
    expect(summary.message).toBe('The one source matches its tracked branch.');
  });

  it('names each moved source and whether the schedule or the operator builds it', () => {
    const summary = new SourceUpdateSummary(
      { total: 3, changed: 2, updates: [update('delta', 'plugin', true), update('epsilon', 'theme', true), update('alpha', 'plugin', false)] },
      [{ slug: 'delta', type: 'plugin', autoBuild: true }, { slug: 'epsilon', type: 'theme', autoBuild: false }],
    );
    expect(summary.title).toBe('2 sources have new commits');
    expect(summary.message).toBe(
      'Built automatically on the next scheduled run: delta (plugin). Not set to build automatically — press Build: epsilon (theme).',
    );
  });

  it('matches a row on type AND slug, so a theme does not borrow a same-named plugin\'s switch', () => {
    const summary = new SourceUpdateSummary(
      { total: 1, changed: 1, updates: [update('zeta', 'theme', true)] },
      [{ slug: 'zeta', type: 'plugin', autoBuild: true }, { slug: 'zeta', type: 'theme', autoBuild: false }],
    );
    expect(summary.title).toBe('1 source has new commits');
    expect(summary.message).toBe('Not set to build automatically — press Build: zeta (theme).');
  });
});
