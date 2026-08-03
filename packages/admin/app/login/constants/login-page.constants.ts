import { AdminPathUtils } from '@/lib/admin-path';
import { AppEnv } from '@/lib/env';

export class LoginPageConstants {
  static readonly loginInputClassName = 'bg-white text-slate-900 placeholder:text-slate-400 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500 dark:border-slate-700';
  /** Deployment-configurable brand logo (see AppEnv.BRAND_LOGO_*): light-scheme and dark-scheme variants. */
  static readonly BRAND_LOGO_LIGHT_PATH = AdminPathUtils.toAdminPath(AppEnv.BRAND_LOGO_LIGHT_PATH);
  static readonly BRAND_LOGO_DARK_PATH = AdminPathUtils.toAdminPath(AppEnv.BRAND_LOGO_DARK_PATH);
}
