import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, vi } from 'vitest';
import { PluginRuntimeContext } from '@react/view/plugin-runtime-context.client';
import { AccountAuthGate } from '@react/account/account-auth-gate';

/**
 * The storefront paints a page with no plugin runtime and then remounts it inside the runtime
 * (`StorefrontRuntimeGate`). The account gate is therefore mounted twice for one visit, and the first
 * copy has no api. It must not treat that as "signed out": that sent a signed-in customer from the
 * account they could already see back to /login.
 */
describe('AccountAuthGate across the runtime remount', () => {
  const replace = vi.fn();
  const t = (_key: string, _params?: unknown, fallback?: string) => fallback ?? '';
  const signedIn = () => ({ get: vi.fn(async () => ({ person: { id: 7, email: 'customer@example.test' } })) });

  beforeEach(() => {
    replace.mockReset();
    vi.stubGlobal('location', { ...window.location, pathname: '/account', search: '', replace });
  });

  afterEach(() => vi.unstubAllGlobals());

  const inRuntime = (api: unknown) => (
    <PluginRuntimeContext.context.Provider value={{ api, translation: { t }, locale: 'en' } as any}>
      <AccountAuthGate><p>Orders</p></AccountAuthGate>
    </PluginRuntimeContext.context.Provider>
  );

  it('stays undecided without a runtime, then shows the account once the runtime remounts it', async () => {
    const { rerender } = render(<AccountAuthGate><p>Orders</p></AccountAuthGate>);
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(replace).not.toHaveBeenCalled();
    expect(screen.queryByText('Please sign in')).toBeNull();

    const api = signedIn();
    rerender(inRuntime(api));
    await screen.findByText('Orders');
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(api.get).toHaveBeenCalledTimes(1);
    expect(replace).not.toHaveBeenCalled();
  });

  it('starts the check when the runtime context reaches an already mounted gate', async () => {
    const api = signedIn();
    const { rerender } = render(inRuntime(undefined));
    rerender(inRuntime(api));
    await screen.findByText('Orders');
    expect(replace).not.toHaveBeenCalled();
  });

  it('shows the account to a signed-in account that has no person record yet', async () => {
    const api = { get: vi.fn(async () => ({ person: null })) };
    render(inRuntime(api));
    await screen.findByText('Orders');
    expect(replace).not.toHaveBeenCalled();
  });

  it('still sends a confirmed guest to sign in', async () => {
    const api = { get: vi.fn(async () => { throw Object.assign(new Error('401'), { statusCode: 401 }); }) };
    render(inRuntime(api));
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/login?next=%2Faccount'));
  });

  it('does not redirect from a gate that was unmounted while its check was in flight', async () => {
    let refuse: (error: Error) => void = () => {};
    const api = { get: vi.fn(() => new Promise((_resolve, reject) => { refuse = reject; })) };
    const { unmount } = render(inRuntime(api));
    await waitFor(() => expect(api.get).toHaveBeenCalled());
    unmount();
    refuse(Object.assign(new Error('401'), { statusCode: 401 }));
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(replace).not.toHaveBeenCalled();
  });

  it('keeps a rate-limited customer signed in and offers a retry that shows the account', async () => {
    let calls = 0;
    const api = { get: vi.fn(async () => {
      calls += 1;
      if (calls === 1) throw Object.assign(new Error('Too many requests'), { statusCode: 429 });
      return { person: { id: 7 } };
    }) };
    render(inRuntime(api));
    await screen.findByText('We could not check your sign-in');
    expect(screen.queryByText('Orders')).toBeNull();
    expect(screen.queryByText('Please sign in')).toBeNull();
    fireEvent.click(screen.getByText('Try again'));
    await screen.findByText('Orders');
    expect(api.get).toHaveBeenCalledTimes(2);
    expect(replace).not.toHaveBeenCalled();
  });

  it('does not take a server error or a dropped connection for a guest', async () => {
    for (const error of [Object.assign(new Error('boom'), { statusCode: 503 }), new TypeError('Failed to fetch')]) {
      const api = { get: vi.fn(async () => { throw error; }) };
      const { unmount } = render(inRuntime(api));
      await screen.findByText('We could not check your sign-in');
      unmount();
    }
    expect(replace).not.toHaveBeenCalled();
  });
});
