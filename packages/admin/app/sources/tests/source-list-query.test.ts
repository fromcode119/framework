import { describe, expect, it } from 'vitest';
import { SourceRow } from '@/app/sources/source-row';
import { SourceListQuery } from '@/app/sources/source-list-query';
import { SourceStatusFilter } from '@/app/sources/enums/source-status-filter.enum';

const build = (slug: string, type: string, lastBuildStatus: string, extra: Record<string, unknown> = {}) =>
  ({ slug, type, lastBuildStatus, gitUrl: `https://github.com/acme/${type}-${slug}.git`, ...extra });

const check = { total: 4, changed: 1, updates: [{ slug: 'shop', type: 'theme', hasUpdate: true, remoteSha: 'abc' }] };

const rows = [
  build('shop', 'plugin', 'success', { changelog: '\n  feat: carts\nfix: totals' }),
  build('shop', 'theme', 'success'),
  build('mail', 'plugin', 'failed'),
  build('blog', 'appearance', 'pending'),
].map((entry) => SourceRow.from(entry, check));

const visible = (query: SourceListQuery) => rows.filter((row) => query.matches(row)).map((row) => row.id);

describe('SourceRow', () => {
  it('is identified by kind and slug, so a plugin and a theme of one name stay two rows', () => {
    expect(rows.map((row) => row.id)).toEqual(['plugin/shop', 'theme/shop', 'plugin/mail', 'appearance/blog']);
  });

  it('marks new commits only on the source the check named, matched on kind as well as slug', () => {
    expect(rows.map((row) => row.hasNewCommits)).toEqual([false, true, false, false]);
  });

  it('shows the newest changelog line and the repository without its scheme and .git', () => {
    expect(rows[0].lastChange).toBe('feat: carts');
    expect(rows[2].lastChange).toBe('');
    expect(rows[0].repository).toBe('github.com/acme/plugin-shop');
  });

  it('treats a source no build has reported on as pending', () => {
    expect(SourceRow.from({ slug: 'new', type: 'plugin' }, null).status).toBe('pending');
  });
});

describe('SourceListQuery', () => {
  it('keeps everything with no search and no filters', () => {
    expect(visible(new SourceListQuery('', SourceListQuery.ALL_TYPES, SourceStatusFilter.ALL))).toHaveLength(4);
  });

  it('narrows by kind, by status and by search together', () => {
    expect(visible(new SourceListQuery('', 'plugin', SourceStatusFilter.ALL))).toEqual(['plugin/shop', 'plugin/mail']);
    expect(visible(new SourceListQuery('', SourceListQuery.ALL_TYPES, SourceStatusFilter.FAILED))).toEqual(['plugin/mail']);
    expect(visible(new SourceListQuery('SHOP', 'theme', SourceStatusFilter.ALL))).toEqual(['theme/shop']);
    expect(visible(new SourceListQuery('acme/appearance', SourceListQuery.ALL_TYPES, SourceStatusFilter.ALL))).toEqual(['appearance/blog']);
  });

  it('counts a failure, a pending build and waiting commits as needing attention', () => {
    expect(visible(new SourceListQuery('', SourceListQuery.ALL_TYPES, SourceStatusFilter.ATTENTION))).toEqual(['theme/shop', 'plugin/mail', 'appearance/blog']);
    expect(visible(new SourceListQuery('', SourceListQuery.ALL_TYPES, SourceStatusFilter.NEW_COMMITS))).toEqual(['theme/shop']);
  });

  it('offers only the kinds the installation tracks, each with its count', () => {
    const [type] = new SourceListQuery('', SourceListQuery.ALL_TYPES, SourceStatusFilter.ALL).filters(rows, true, () => undefined, () => undefined);
    expect(type.options.map((option) => option.value)).toEqual(['all', 'appearance', 'plugin', 'theme']);
    expect(type.options[2].label).toBe('Plugins (2)');
  });

  it('offers "New commits" only once an update check has answered', () => {
    const query = new SourceListQuery('', SourceListQuery.ALL_TYPES, SourceStatusFilter.ALL);
    const values = (checked: boolean) => query.filters(rows, checked, () => undefined, () => undefined)[1].options.map((option) => option.value);
    expect(values(false)).not.toContain('newCommits');
    expect(values(true)).toContain('newCommits');
  });

  it('reports a filter as active only when it narrows, and resets it to "all"', () => {
    let applied = '';
    const [, status] = new SourceListQuery('', SourceListQuery.ALL_TYPES, SourceStatusFilter.FAILED).filters(rows, false, () => undefined, (value) => { applied = value; });
    expect(status.isActive).toBe(true);
    expect(status.valueLabel).toBe('Failed (1)');
    status.reset();
    expect(applied).toBe('all');
  });
});
