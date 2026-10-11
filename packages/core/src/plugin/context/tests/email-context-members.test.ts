import { describe, expect, it, vi } from 'vitest';
import { EmailContextProxy } from '@core/plugin/context/email';

/**
 * `context.email` is a list of named members, never the mail driver itself: the driver holds framework
 * objects (the suppression list's database handle), and nothing a plugin reaches may lead to them.
 */
describe('context.email members', () => {
  const driver = {
    db: { find: vi.fn() },
    inner: { send: vi.fn() },
    send: vi.fn(async function (this: unknown) { return this; }),
    suppress: vi.fn(async () => true),
    isSuppressed: vi.fn(async () => false),
  };
  const email = EmailContextProxy.createEmailProxy({ manifest: { slug: 'shop' } } as any, { integrations: { email: driver } } as any, async () => null);

  it('does not expose what the driver holds', () => {
    expect(email.db).toBeUndefined();
    expect(email.inner).toBeUndefined();
  });

  it('forwards send, suppress and isSuppressed to the driver as the driver', async () => {
    await expect(email.send({ to: 'a@b.test' })).resolves.toBe(driver);
    await email.suppress('a@b.test', 'news');
    await email.isSuppressed('a@b.test', 'news');
    expect(driver.suppress).toHaveBeenCalledWith('a@b.test', 'news');
    expect(driver.isSuppressed).toHaveBeenCalledWith('a@b.test', 'news');
  });

  it('keeps the framework additions', () => {
    expect(Object.keys(email).sort()).toEqual([
      'buildPreferencesUrl', 'inbox', 'isSuppressed', 'listCategories', 'logoUrl', 'registerCategory', 'send', 'suppress', 'unsuppress',
    ]);
  });
});
