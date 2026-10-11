import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import { PluginRuntimeContext } from '@react/view/plugin-runtime-context.client';
import { AccountChannelPreferences } from '@react/account/channel-preferences';

/**
 * Account → Notifications, texts and offers: the switches record agreements with the number the person
 * typed, the server's refusal is shown, and a site with no text-message provider says so instead of
 * offering a switch that would do nothing.
 */
describe('Account → Notifications: texts and offers', () => {
  const mount = (preferences: Record<string, unknown>, refuse = '', answer: Record<string, unknown> = { success: true }) => {
    const posts: Array<{ path: string; body: any }> = [];
    const api = {
      get: vi.fn(async () => preferences),
      post: vi.fn(async (path: string, body: any) => {
        posts.push({ path, body });
        if (refuse) throw Object.assign(new Error('refused'), { data: { error: refuse } });
        return answer;
      }),
    };
    const t = (_key: string, _params?: unknown, fallback?: string) => fallback ?? '';
    render(
      <PluginRuntimeContext.context.Provider value={{ api, translation: { t }, locale: 'en' } as any}>
        <AccountChannelPreferences pushSupported />
      </PluginRuntimeContext.context.Provider>,
    );
    return { api, posts };
  };

  it('says texts are not offered when the site has no provider, and offers no text switches', async () => {
    mount({ sms: { available: false, phone: '', updates: false, offers: false }, push: { offers: false } });
    await screen.findByText('This site does not send text messages.');
    expect(screen.queryByText('Updates by text')).toBeNull();
    expect(screen.getByText('Offers as notifications')).toBeDefined();
  });

  it('records an agreement to texted updates with the number typed, and shows the server\'s refusal', async () => {
    const { posts } = mount({ sms: { available: true, phone: '', updates: false, offers: false }, push: { offers: false } }, 'Enter your number with its country code');
    const phone = await screen.findByLabelText('Mobile number');
    fireEvent.change(phone, { target: { value: '0881234567' } });
    const updates = screen.getByText('Updates by text').closest('li')!.querySelector('input[type=checkbox]')!;
    fireEvent.click(updates);
    await waitFor(() => expect(posts).toHaveLength(1));
    expect(posts[0].body).toEqual({ channel: 'sms', category: 'updates', enabled: true, phone: '0881234567', code: '' });
    await screen.findByText('Enter your number with its country code');
  });

  it('asks for the code texted to a new number, and sends the same switch again with it', async () => {
    const { posts, api } = mount({ sms: { available: true, phone: '', updates: false, offers: false }, push: { offers: false } }, '', { verificationRequired: true, phone: '+359881234567' });
    fireEvent.change(await screen.findByLabelText('Mobile number'), { target: { value: '+359881234567' } });
    fireEvent.click(screen.getByText('Updates by text').closest('li')!.querySelector('input[type=checkbox]')!);
    await screen.findByText('We sent a code to {{phone}}. Enter it to switch texts on.');
    api.post.mockImplementation(async (path: string, body: any) => { posts.push({ path, body }); return { success: true }; });
    fireEvent.change(document.querySelector('input[autocomplete=one-time-code]')!, { target: { value: '123456' } });
    fireEvent.click(screen.getByText('Confirm'));
    await waitFor(() => expect(posts).toHaveLength(2));
    expect(posts[1].body).toEqual({ channel: 'sms', category: 'updates', enabled: true, phone: '+359881234567', code: '123456' });
    await waitFor(() => expect(screen.queryByText('Confirm')).toBeNull());
  });

  it('turning offers as notifications on and off records each choice', async () => {
    const { posts } = mount({ sms: { available: false, phone: '', updates: false, offers: false }, push: { offers: false } });
    const offers = (await screen.findByText('Offers as notifications')).closest('li')!.querySelector('input[type=checkbox]')!;
    fireEvent.click(offers);
    await waitFor(() => expect(posts).toHaveLength(1));
    expect(posts[0].body).toMatchObject({ channel: 'push', category: 'offers', enabled: true });
  });
});
