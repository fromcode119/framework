import { fireEvent, render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import { PluginRuntimeContext } from '@react/view/plugin-runtime-context.client';
import { AuthTranslations } from '@react/auth/auth-translations';
import { AuthRegisterForm } from '@react/auth/auth-register-form';

/**
 * The server says whether the confirmation email left (`emailDelivery`). The page ignored it and always
 * said "we sent a confirmation link" — on a site with no mail set up, the person waited for a message
 * that was never coming, with no way to ask for it again.
 */
describe('AuthRegisterForm — the confirmation email did not leave', () => {
  AuthTranslations.register();
  const t = (_key: string, _params?: unknown, fallback?: string) => fallback ?? '';

  const signUp = async (api: unknown) => {
    const view = render(
      <PluginRuntimeContext.context.Provider value={{ api, translation: { t }, locale: 'en' } as any}>
        <AuthRegisterForm documentLocale="en" />
      </PluginRuntimeContext.context.Provider>,
    );
    const fill = (name: string, value: string) => fireEvent.change(view.container.querySelector(`input[name="${name}"]`) as HTMLInputElement, { target: { value } });
    fill('firstName', 'Reg'); fill('email', 'reg@example.com'); fill('password', 'Long-enough-1'); fill('confirmPassword', 'Long-enough-1');
    fireEvent.submit(view.container.querySelector('form') as HTMLFormElement);
  };
  const created = (emailDelivery: string) => ({ success: true, requiresEmailVerification: true, emailDelivery });

  it('says the email was sent only when it was', async () => {
    await signUp({ post: vi.fn(async () => created('sent')) });

    await screen.findByText('Check your inbox');
    expect(screen.queryByText('Send the confirmation email again')).toBeNull();
  });

  it('says it could not be sent, and offers to send it again', async () => {
    await signUp({ post: vi.fn(async () => created('failed')) });

    await screen.findByText(/we could not send the confirmation email/);
    expect(screen.queryByText('Check your inbox')).toBeNull();
    expect(screen.getByText('Send the confirmation email again')).toBeTruthy();
  });

  it('after a resend that left, tells the person to check their inbox', async () => {
    const post = vi.fn().mockResolvedValueOnce(created('failed')).mockResolvedValueOnce({ success: true });
    await signUp({ post });

    fireEvent.click(await screen.findByText('Send the confirmation email again'));

    await screen.findByText('Check your inbox');
    expect(post).toHaveBeenCalledTimes(2);
  });

  it('keeps saying so when the resend fails too', async () => {
    const post = vi.fn().mockResolvedValueOnce(created('failed')).mockResolvedValueOnce({ success: true, emailDelivery: 'failed' });
    await signUp({ post });

    fireEvent.click(await screen.findByText('Send the confirmation email again'));

    await screen.findByText('We could not send the email. Please try again later.');
    expect(screen.queryByText('Check your inbox')).toBeNull();
  });
});
