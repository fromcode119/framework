import { describe, expect, it } from 'vitest';
import { AppPathConstants } from '@core/constants/app-path.constants';

/**
 * The admin has its own pages directly under `/plugins/` (`installed`, `health`, `marketplace`), and a
 * static route wins over `/plugins/[slug]` — so a plugin named like one of them could never open its own
 * page. Its page is addressed under `installed/`, where nothing static competes.
 */
describe('a plugin\'s admin page address', () => {
  const paths = AppPathConstants.ADMIN.PLUGINS;

  it('lives under installed/, for every slug', () => {
    for (const slug of ['shop', 'marketplace', 'health', 'installed']) {
      expect(paths.DETAIL(slug)).toBe(`/plugins/installed/${slug}`);
      expect(paths.SETTINGS(slug)).toBe(`/plugins/installed/${slug}/settings`);
      expect(paths.SETTINGS_TAB(slug)).toBe(`/plugins/installed/${slug}?tab=settings`);
    }
  });

  it('never resolves to one of the admin\'s own plugin pages', () => {
    const own = [paths.INSTALLED, paths.HEALTH, paths.MARKETPLACE];
    for (const slug of ['marketplace', 'health', 'installed']) {
      expect(own).not.toContain(paths.DETAIL(slug));
    }
  });
});
