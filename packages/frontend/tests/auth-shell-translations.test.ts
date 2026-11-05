import { readFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import { FrameworkTranslations } from '@fromcode119/react/i18n/framework-translations';
import { AuthTranslations } from '@fromcode119/react/auth/auth-translations';
import EN from '@fromcode119/react/auth/i18n/en.json';
import BG from '@fromcode119/react/auth/i18n/bg.json';

/**
 * The framework /login rendered English on a Bulgarian shop: the auth shell had no copy of its own, so
 * every key fell to its English default. It now ships its words like the account shell does.
 */
describe('the framework auth shell copy', () => {
  AuthTranslations.register();

  it('resolves in the document locale on the server', () => {
    expect(FrameworkTranslations.in('bg', 'auth.login.title')).toBe('Вход');
    expect(FrameworkTranslations.in('bg-BG', 'auth.login.noAccount')).toBe('Нямате профил?');
    expect(FrameworkTranslations.in('en', 'auth.login.title')).toBe('Sign in');
  });

  it('every language carries every key', () => {
    const keys = (node: object, prefix = ''): string[] => Object.entries(node).flatMap(([key, value]) =>
      value && typeof value === 'object' ? keys(value, `${prefix}${key}.`) : [`${prefix}${key}`]);
    expect(keys(BG).sort()).toEqual(keys(EN).sort());
  });

  it('every key the forms read is in the copy', () => {
    const dir = join(__dirname, '..', '..', 'react', 'src', 'auth');
    const used = ['auth-login-form.tsx', 'auth-register-form.tsx', 'auth-forgot-form.tsx', 'auth-reset-form.tsx', 'auth-shell-implementation.tsx', 'auth-social-sign-in.tsx']
      .flatMap((file) => [...readFileSync(join(dir, file), 'utf8').matchAll(/this\.tr\('([^']+)'/g)].map((match) => match[1]));
    for (const key of used) expect(FrameworkTranslations.in('bg', key), key).not.toBe(key);
  });
});
