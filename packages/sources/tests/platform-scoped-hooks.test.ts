import { describe, it, expect, vi } from 'vitest';
import { HookManager, RequestContextUtils } from '@fromcode119/core';
import { PlatformScopedHooks } from '@sources/events/hooks/platform-scoped-hooks';

describe('PlatformScopedHooks', () => {
  const setup = () => {
    const manager = new HookManager();
    const handler = vi.fn(async () => ({ sources: ['one'] }));
    new PlatformScopedHooks(manager).on('sources:list', handler);
    return { manager, handler };
  };

  it('answers at platform scope', async () => {
    const { manager, handler } = setup();
    await expect(manager.call('sources:list', {})).resolves.toEqual({ sources: ['one'] });
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('refuses a call made while a site is bound, and never runs the handler', async () => {
    const { manager, handler } = setup();
    const call = RequestContextUtils.storage.run({ tenantId: 'acme' } as any, () => manager.call('sources:list', {}));
    await expect(call).rejects.toThrow(/platform control.*"acme"/);
    expect(handler).not.toHaveBeenCalled();
  });

  it('treats an empty tenant id as platform scope', async () => {
    const { manager } = setup();
    const call = RequestContextUtils.storage.run({ tenantId: '' } as any, () => manager.call('sources:list', {}));
    await expect(call).resolves.toEqual({ sources: ['one'] });
  });
});
