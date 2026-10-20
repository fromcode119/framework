import path from 'path';
import { describe, expect, it } from 'vitest';
import { MediaPathUtils } from '@core/security/media-path-utils';
import { SystemConstants } from '@core/constants/system.constants';

/** A theme UI asset reference resolves inside `<themes>/<slug>/ui` and nowhere else. */
describe('MediaPathUtils.resolveSafeThemeAssetDiskPath', () => {
  const themes = path.resolve('/srv/themes');
  const ref = (slug: string, asset: string) => String(SystemConstants.API_PATH.THEMES.UI)
    .replace(':slug', slug)
    .replace(/\*[A-Za-z0-9_]*$/, asset);

  it('resolves an asset inside the theme’s own ui directory', () => {
    expect(MediaPathUtils.resolveSafeThemeAssetDiskPath(themes, ref('shop', 'bundle.js')))
      .toBe(path.join(themes, 'shop', 'ui', 'bundle.js'));
  });

  it('refuses a path that climbs out of ui into ANOTHER theme', () => {
    expect(MediaPathUtils.resolveSafeThemeAssetDiskPath(themes, ref('shop', '../../other/theme.json'))).toBeNull();
    expect(MediaPathUtils.resolveSafeThemeAssetDiskPath(themes, ref('shop', '../../other/ui/bundle.js'))).toBeNull();
  });

  it('refuses a path that climbs out of ui into the theme’s own source', () => {
    expect(MediaPathUtils.resolveSafeThemeAssetDiskPath(themes, ref('shop', '../theme.json'))).toBeNull();
  });

  it('refuses a traversing slug', () => {
    expect(MediaPathUtils.resolveSafeThemeAssetDiskPath(themes, ref('..', 'x.js'))).toBeNull();
  });
});
