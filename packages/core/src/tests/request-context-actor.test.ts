import { describe, expect, it } from 'vitest';
import { RequestContextUtils } from '@core/context/request-context';
import { AuthContextProxy } from '@core/plugin/context/auth';
import { PluginHostCallbacks } from '@core/plugin/host/plugin-host-callbacks';
import { PluginHostDispatcher } from '@core/plugin/host/plugin-host-dispatcher';
import { PluginInvocationTokens } from '@core/plugin/host/plugin-invocation-tokens';

const admin = { id: 7, email: 'admin@example.com', firstName: 'Ada', lastName: 'Admin' };

describe('RequestContextUtils.runAs', () => {
  it('records the actor for the work, keeping the rest of the request context', () => {
    RequestContextUtils.storage.run({ locale: 'en', tenantId: 't1' }, () => {
      RequestContextUtils.runAs(admin, () => {
        expect(RequestContextUtils.getUser()).toEqual(admin);
        expect(RequestContextUtils.getTenantId()).toBe('t1');
        expect(RequestContextUtils.getLocale()).toBe('en');
      });
      expect(RequestContextUtils.getUser()).toBeUndefined();
    });
  });

  it('carries the actor across awaits inside the work', async () => {
    await RequestContextUtils.storage.run({ locale: 'en' }, () =>
      RequestContextUtils.runAs(admin, async () => {
        await new Promise((resolve) => setTimeout(resolve, 1));
        expect(RequestContextUtils.getUser()).toEqual(admin);
      }));
  });

  it('opens no request context outside a request, and names no actor', () => {
    RequestContextUtils.runAs(admin, () => {
      expect(RequestContextUtils.storage.getStore()).toBeUndefined();
      expect(RequestContextUtils.getUser()).toBeUndefined();
    });
  });

  it('with no user runs the work unchanged', () => {
    RequestContextUtils.storage.run({ locale: 'en' }, () => {
      RequestContextUtils.runAs(undefined, () => expect(RequestContextUtils.getUser()).toBeUndefined());
    });
  });
});

describe('context.auth.actor()', () => {
  it('answers the user a collection write runs for', async () => {
    const auth = AuthContextProxy.createAuthProxy({ guard: () => undefined });
    await RequestContextUtils.storage.run({ locale: 'en' }, () =>
      RequestContextUtils.runAs(admin, async () => expect(await auth.actor()).toEqual(admin)));
  });

  it('answers null when no user asked for the work', async () => {
    const auth = AuthContextProxy.createAuthProxy({ guard: () => undefined });
    await RequestContextUtils.storage.run({ locale: 'en' }, async () => expect(await auth.actor()).toBeNull());
  });

  it('answers null before auth is wired', async () => {
    const auth = AuthContextProxy.createAuthProxy(undefined);
    await RequestContextUtils.storage.run({ locale: 'en', user: admin }, async () => expect(await auth.actor()).toBeNull());
  });

  it('reaches an isolated plugin: its call is answered in the context of the write that fired its hook', async () => {
    const tokens = new PluginInvocationTokens();
    const db = { withTenant: async (_tenantId: string, fn: () => Promise<unknown>) => fn() };
    const dispatcher = new PluginHostDispatcher('alpha', tokens, db, {}, new PluginHostCallbacks('alpha', async () => undefined));
    const context: any = { auth: AuthContextProxy.createAuthProxy({ guard: () => undefined }) };

    // The host mints the hook's token from the store current when the hook fires — the write's.
    const token = RequestContextUtils.storage.run({ locale: 'en', tenantId: 't1' }, () =>
      RequestContextUtils.runAs(admin, () => tokens.mint('hook', RequestContextUtils.storage.getStore())));

    const actor = await dispatcher.dispatch(context, { root: 'context', steps: [{ name: 'auth' }, { name: 'actor', args: [] }], token });
    expect(actor).toEqual(admin);
  });
});
