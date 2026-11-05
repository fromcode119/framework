import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, vi } from 'vitest';
import { PluginRuntimeContext } from '@react/view/plugin-runtime-context.client';
import { AuthTranslations } from '@react/auth/auth-translations';
import { AuthVerifyForm } from '@react/auth/auth-verify-form';

/**
 * The confirmation page used to show a raw token field, and kept offering "Did not get the email?"
 * after the email was already confirmed. The link now confirms on arrival; a confirmed visitor sees
 * the confirmation and the sign-in button only, and a refused link explains itself in the page language.
 */
describe('AuthVerifyForm', () => {
  AuthTranslations.register();
  const t = (_key: string, _params?: unknown, fallback?: string) => fallback ?? '';

  afterEach(() => window.history.replaceState({}, '', '/'));

  const mount = (api: unknown) => render(
    <PluginRuntimeContext.context.Provider value={{ api, translation: { t }, locale: 'bg' } as any}>
      <AuthVerifyForm documentLocale="bg" />
    </PluginRuntimeContext.context.Provider>,
  );

  it('confirms the emailed link on arrival and then offers only sign-in', async () => {
    window.history.replaceState({}, '', '/verify-email?token=tok-ok');
    const api = { post: vi.fn(async () => ({ success: true })) };
    mount(api);
    await screen.findByText('Имейлът ви е потвърден');
    expect(api.post).toHaveBeenCalledTimes(1);
    expect(api.post.mock.calls[0][1]).toEqual({ token: 'tok-ok' });
    expect(screen.getByRole('link', { name: 'Вход' }).getAttribute('href')).toBe('/login');
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(screen.queryByText('Изпрати нова връзка')).toBeNull();
  });

  it('explains a refused link in the page language and offers a new one', async () => {
    window.history.replaceState({}, '', '/verify-email?token=tok-old');
    const refused = Object.assign(new Error('Verification link has expired. Please request a new one.'), {
      statusCode: 400, data: { error: 'Verification link has expired. Please request a new one.', code: 'tokenExpired' },
    });
    mount({ post: vi.fn(async () => { throw refused; }) });
    await screen.findByText('Връзката е изтекла. Поискайте нова.');
    expect(screen.queryByText(/Verification link has expired/)).toBeNull();
    expect(screen.getByText('Изпрати нова връзка')).toBeTruthy();
  });

  it('without a token asks the visitor to open the link and offers a new one', async () => {
    window.history.replaceState({}, '', '/verify-email');
    const api = { post: vi.fn() };
    mount(api);
    await screen.findByText('Проверете пощата си');
    await waitFor(() => expect(screen.getByText('Изпрати нова връзка')).toBeTruthy());
    expect(api.post).not.toHaveBeenCalled();
  });
});
