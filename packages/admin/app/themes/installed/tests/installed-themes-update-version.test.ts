import { describe, expect, it } from 'vitest';
import { InstalledThemesPageController } from '@/app/themes/installed/installed-themes-page-controller';
import type { IInstalledThemeManifest } from '@/app/themes/installed/interfaces/installed-theme-manifest.interface';

const theme = (version: string) => ({ slug: 'shop', version }) as IInstalledThemeManifest;

describe('InstalledThemesPageController.resolveUpdateVersion', () => {
  it('offers a newer marketplace version', () => {
    expect(InstalledThemesPageController.resolveUpdateVersion(theme('1.2.5'), [theme('1.2.6')])).toBe('1.2.6');
  });

  it('never offers an older marketplace version as an update', () => {
    expect(InstalledThemesPageController.resolveUpdateVersion(theme('1.2.34'), [theme('1.2.6')])).toBeNull();
  });

  it('offers nothing for the same version', () => {
    expect(InstalledThemesPageController.resolveUpdateVersion(theme('1.2.6'), [theme('1.2.6')])).toBeNull();
  });
});
