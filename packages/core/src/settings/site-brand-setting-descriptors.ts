import { SettingScope } from '@core/settings/enums/setting-scope.enum';
import { SystemConstants } from '@core/constants/system.constants';

/**
 * The site's brand files of {@link SystemSettingDescriptors} — Settings → General. Each holds what the
 * media picker hands back (`MediaPickerAsset`). SITE-scoped: every site picks its own.
 *
 * Neither is seeded. A blank email logo means no logo — the email says nothing it was not given. A blank
 * site icon means the active theme's own icon, then the platform's mark, and the admin names which
 * (`SiteIconResolver`).
 */
export class SiteBrandSettingDescriptors {
  static readonly ALL = {
    [SystemConstants.META_KEY.EMAIL_LOGO]: { scope: SettingScope.SITE, writable: true, exposed: true },
    [SystemConstants.META_KEY.SITE_ICON]: { scope: SettingScope.SITE, writable: true, exposed: true },
  };
}
