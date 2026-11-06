import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import { PluginRuntimeContext } from '@react/view/plugin-runtime-context.client';
import { AuthTranslations } from '@react/auth/auth-translations';
import { AuthLoginForm } from '@react/auth/auth-login-form';

/**
 * A successful sign-in hands over to the next page with a full navigation. The button used to return
 * to "Sign in" the moment that navigation started, so while a slow account page loaded the visitor saw
 * an idle form and read it as a login that did nothing.
 */
describe('AuthLoginForm', () => {
  AuthTranslations.register();
  const t = (_key: string, _params?: unknown, fallback?: string) => fallback ?? '';

  const mount = (api: unknown) => render(
    <PluginRuntimeContext.context.Provider value={{ api, translation: { t }, locale: 'en' } as any}>
      <AuthLoginForm />
    </PluginRuntimeContext.context.Provider>,
  );

  const submit = () => {
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'a@example.com' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'secret-value' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
  };

  it('stays busy after a successful sign-in until the next page replaces it', async () => {
    const assign = vi.fn();
    vi.spyOn(window, 'location', 'get').mockReturnValue({ ...window.location, assign } as any);
    mount({ post: vi.fn(async () => ({ token: 't', user: { id: '1', email: 'a@example.com' } })) });
    submit();
    await waitFor(() => expect(assign).toHaveBeenCalled());
    expect(screen.getByRole('button', { name: 'Signing in…' }).hasAttribute('disabled')).toBe(true);
    vi.restoreAllMocks();
  });

  it('returns to the idle button and shows why when the sign-in is refused', async () => {
    mount({ post: vi.fn(async () => { throw Object.assign(new Error('Invalid email or password'), { statusCode: 401 }); }) });
    submit();
    await screen.findByRole('button', { name: 'Sign in' });
    expect(document.querySelector('.fc-auth__error')).toBeTruthy();
  });
});
