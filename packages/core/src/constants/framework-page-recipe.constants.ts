/**
 * The page recipes the framework itself renders: the sign-in surfaces and the account.
 *
 * A site page carrying one of these recipes shows the framework's surface inside the theme's layout.
 * The storefront gives a site with no such page a page of its own for the path, so signing in never
 * depends on a theme seeding one.
 */
export class FrameworkPageRecipe {
  static readonly LOGIN = 'auth.login';
  static readonly REGISTER = 'auth.register';
  static readonly FORGOT_PASSWORD = 'auth.forgot-password';
  static readonly RESET_PASSWORD = 'auth.reset-password';
  static readonly VERIFY_EMAIL = 'auth.verify-email';
  static readonly ACCOUNT = 'account.shell';
}
