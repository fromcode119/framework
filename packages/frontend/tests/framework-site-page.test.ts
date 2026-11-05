import { afterEach, describe, expect, it, vi } from 'vitest';
import { FrameworkPageRecipe } from '@fromcode119/core/client';
import { FrameworkSitePage } from '@/lib/document/framework-site-page';
import { FrontendAuthUtils } from '@/lib/frontend-auth-settings';

/**
 * A site whose theme seeds no sign-in or account page still has them: the storefront gives the path a
 * page with the framework's recipe, rendered inside the theme's layout. A theme with no `login` page
 * used to leave its customers with no way to sign in at all.
 */
describe('FrameworkSitePage', () => {
  afterEach(() => { vi.restoreAllMocks(); });

  function settings(auth: boolean, registration: boolean): void {
    vi.spyOn(FrontendAuthUtils, 'isFrontendAuthEnabled').mockResolvedValue(auth);
    vi.spyOn(FrontendAuthUtils, 'isFrontendRegistrationEnabled').mockResolvedValue(registration);
  }

  it('gives every sign-in path and the account its recipe, titled in the page language', async () => {
    settings(true, true);
    const expected: Record<string, [string, string]> = {
      login: [FrameworkPageRecipe.LOGIN, 'Вход'],
      register: [FrameworkPageRecipe.REGISTER, 'Регистрация'],
      'forgot-password': [FrameworkPageRecipe.FORGOT_PASSWORD, 'Забравена парола'],
      'reset-password': [FrameworkPageRecipe.RESET_PASSWORD, 'Нова парола'],
      'verify-email': [FrameworkPageRecipe.VERIFY_EMAIL, 'Потвърждаване на имейла'],
      account: [FrameworkPageRecipe.ACCOUNT, 'Моят профил'],
      'account/orders': [FrameworkPageRecipe.ACCOUNT, 'Моят профил'],
    };
    for (const [slug, [recipe, title]] of Object.entries(expected)) {
      expect(await FrameworkSitePage.resolve(slug, 'bg'), slug).toEqual({ slug, title, recipe, locale: 'bg' });
    }
  });

  it('is not a page for any other path', async () => {
    settings(true, true);
    for (const slug of ['about', 'login/extra', 'accounts', 'verify-email-change']) {
      expect(await FrameworkSitePage.resolve(slug, 'en'), slug).toBeNull();
    }
  });

  it('honours the storefront sign-in and registration switches; emailed links always work', async () => {
    settings(false, false);
    for (const slug of ['login', 'register', 'forgot-password']) expect(await FrameworkSitePage.resolve(slug, 'en'), slug).toBeNull();
    for (const slug of ['reset-password', 'verify-email', 'account']) expect(await FrameworkSitePage.resolve(slug, 'en'), slug).not.toBeNull();

    vi.restoreAllMocks();
    settings(true, false);
    expect(await FrameworkSitePage.resolve('register', 'en')).toBeNull();
    expect(await FrameworkSitePage.resolve('login', 'en')).not.toBeNull();
  });
});
