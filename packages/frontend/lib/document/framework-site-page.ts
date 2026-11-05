import { AccountRouteUtils, FrameworkPageRecipe, RouteConstants } from '@fromcode119/core/client';
import { FrontendAuthUtils } from '@/lib/frontend-auth-settings';
import { FrontendCopy } from '@/lib/i18n/frontend-copy';

/** One path the framework owns: the recipe its page carries, its title key, and when it is offered. */
interface IFrameworkSitePageRoute {
  readonly recipe: string;
  readonly titleKey: string;
  readonly needsAuth: boolean;
  readonly needsRegistration: boolean;
}

/**
 * The page a site shows at a sign-in or account path when its content has none.
 *
 * Signing in is the framework's flow, not the theme's: a theme that seeds a `login` page keeps it,
 * and one that seeds nothing still gets a working sign-in — rendered through the same islands document
 * as every other page, so the theme's header, footer and styles surround it. The page is a plain
 * content entry with a recipe; `FrameworkPageDesigns` (in `@fromcode119/react`) renders the recipe on
 * the server and in the browser.
 *
 * The switches the operator sets still apply: with storefront sign-in off, the sign-in paths are
 * not offered (404), and with registration off, neither is `/register`. A reset or confirmation link
 * from an email always works, because it was sent to someone who already has an account.
 */
export class FrameworkSitePage {
  private static readonly ROUTES: Record<string, IFrameworkSitePageRoute> = {
    [RouteConstants.SEGMENTS.LOGIN]: { recipe: FrameworkPageRecipe.LOGIN, titleKey: 'login', needsAuth: true, needsRegistration: false },
    [RouteConstants.SEGMENTS.REGISTER]: { recipe: FrameworkPageRecipe.REGISTER, titleKey: 'register', needsAuth: true, needsRegistration: true },
    [RouteConstants.SEGMENTS.FORGOT_PASSWORD]: { recipe: FrameworkPageRecipe.FORGOT_PASSWORD, titleKey: 'forgotPassword', needsAuth: true, needsRegistration: false },
    [RouteConstants.SEGMENTS.RESET_PASSWORD]: { recipe: FrameworkPageRecipe.RESET_PASSWORD, titleKey: 'resetPassword', needsAuth: false, needsRegistration: false },
    [RouteConstants.SEGMENTS.VERIFY_EMAIL]: { recipe: FrameworkPageRecipe.VERIFY_EMAIL, titleKey: 'verifyEmail', needsAuth: false, needsRegistration: false },
  };

  private static readonly ACCOUNT_ROUTE: IFrameworkSitePageRoute = { recipe: FrameworkPageRecipe.ACCOUNT, titleKey: 'account', needsAuth: false, needsRegistration: false };

  /** The framework page for `slug` (no leading slash), or null when the path is not one or is switched off. */
  static async resolve(slug: string, locale: string): Promise<Record<string, unknown> | null> {
    const path = `/${String(slug || '').replace(/^\/+|\/+$/g, '')}`;
    const account = AccountRouteUtils.base();
    const route = path === account || AccountRouteUtils.parseSection(path) ? FrameworkSitePage.ACCOUNT_ROUTE : FrameworkSitePage.ROUTES[path];
    if (!route) return null;
    if (route.needsAuth && !(await FrontendAuthUtils.isFrontendAuthEnabled())) return null;
    if (route.needsRegistration && !(await FrontendAuthUtils.isFrontendRegistrationEnabled())) return null;
    return {
      slug: path.slice(1),
      title: FrontendCopy.t(locale, `frontend.frameworkPages.${route.titleKey}.title`),
      recipe: route.recipe,
      locale,
    };
  }
}
