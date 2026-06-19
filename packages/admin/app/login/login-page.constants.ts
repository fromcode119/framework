import { AdminPathUtils } from '@/lib/admin-path';

export class LoginPageConstants {
  static readonly loginInputClassName = 'bg-white text-slate-900 placeholder:text-slate-400 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500 dark:border-slate-700';
  static readonly ATLANTIS_LOGO_SLATE_PATH = AdminPathUtils.toAdminPath('/brand/atlantis-logo-slate.png');
  static readonly ATLANTIS_LOGO_WHITE_PATH = AdminPathUtils.toAdminPath('/brand/atlantis-logo-white.png');
}
