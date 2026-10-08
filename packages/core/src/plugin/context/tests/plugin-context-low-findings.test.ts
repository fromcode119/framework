import { describe, expect, it, vi } from 'vitest';
import { JobsContextProxy } from '@core/plugin/context/jobs';
import { EmailContextProxy } from '@core/plugin/context/email';
import { EmailCategoryRegistry } from '@core/email/email-category-registry';
import { SmsContextProxy } from '@core/plugin/context/sms';
import { RuntimeModuleBridgeGuard } from '@core/plugin/context/runtime-module-bridge-guard';

const allowed = (granted: string[] = ['jobs', 'cache']) => ({
  hasCapability: vi.fn((cap: string) => granted.includes(cap)),
  handleViolation: vi.fn((cap: string) => { throw new Error(`Missing "${cap}"`); }),
  handleRateLimit: vi.fn(),
});

/** `del` and `exists` take many keys; only the first was put in the plugin's keyspace. */
describe('context.redis multi-key commands', () => {
  it('prefixes every key of del and exists', async () => {
    const redis = { del: vi.fn(async () => 1), exists: vi.fn(async () => 1), get: vi.fn(async () => null) };
    const proxy: any = JobsContextProxy.createRedisProxy({ manifest: { slug: 'shop' } } as any, { jobs: { redis } } as any, allowed() as any);

    await proxy.del('mine', 'bull:queue:jobs');
    await proxy.exists('a', 'b');

    const [first, second] = (redis.del.mock.calls[0] as unknown) as string[];
    expect(first.endsWith('mine')).toBe(true);
    expect(second).not.toBe('bull:queue:jobs');
    expect(second.endsWith('bull:queue:jobs')).toBe(true);
    expect(second.startsWith(first.slice(0, first.length - 'mine'.length))).toBe(true);
    for (const key of (redis.exists.mock.calls[0] as unknown) as string[]) expect(key).toMatch(/^.+[ab]$/);
  });
});

/** `unsuppress` forwarded untouched: any plugin could lift any opt-out, or every one at once. */
describe('context.email.unsuppress', () => {
  function setup() {
    const emailCategories = new EmailCategoryRegistry();
    const driver = { unsuppress: vi.fn(async () => undefined) };
    const proxyFor = (slug: string) => EmailContextProxy.createEmailProxy({ manifest: { slug } } as any, { integrations: { email: driver }, emailCategories } as any, async () => null);
    return { emailCategories, driver, proxyFor };
  }

  it('re-subscribes to a stream the plugin declared', async () => {
    const { proxyFor, driver } = setup();
    const broadcasts = proxyFor('broadcasts');
    broadcasts.registerCategory({ key: 'broadcast', labelKey: 'x', descriptionKey: 'y' });

    await broadcasts.unsuppress('a@b.test', 'broadcast');

    expect(driver.unsuppress).toHaveBeenCalledWith('a@b.test', 'broadcast');
  });

  it('refuses another plugin’s stream and the global opt-out', async () => {
    const { proxyFor, driver } = setup();
    proxyFor('broadcasts').registerCategory({ key: 'broadcast', labelKey: 'x', descriptionKey: 'y' });
    const evil = proxyFor('evil');

    await expect(evil.unsuppress('a@b.test', 'broadcast')).rejects.toThrow(/refused/);
    await expect(evil.unsuppress('a@b.test')).rejects.toThrow(/refused/);
    expect(driver.unsuppress).not.toHaveBeenCalled();
  });

  it('does not let another plugin take a stream over by registering its key', async () => {
    const { proxyFor, emailCategories } = setup();
    proxyFor('broadcasts').registerCategory({ key: 'broadcast', labelKey: 'x', descriptionKey: 'y' });
    proxyFor('evil').registerCategory({ key: 'broadcast', labelKey: 'x', descriptionKey: 'y' });

    expect(emailCategories.ownerOf('broadcast')).toBe('broadcasts');
  });
});

/** Withdrawing a number's SMS consent is what a provider reports; any other plugin could silence anyone. */
describe('context.sms.optOut', () => {
  const manager: any = { integrations: { registerProvider: vi.fn() }, db: {} };

  it('refuses a plugin that sends no text messages', async () => {
    const sms = SmsContextProxy.createSmsProxy({ manifest: { slug: 'nosy', namespace: 'x' } } as any, manager);

    await expect(sms.optOut('+359888000000')).rejects.toThrow(/sends no text messages/);
  });

  it('lets the provider plugin pass on a carrier opt-out', async () => {
    const sms = SmsContextProxy.createSmsProxy({ manifest: { slug: 'sms-provider', namespace: 'x' } } as any, manager);
    sms.registerProvider({ key: 'carrier', label: 'Carrier', fields: [], send: async () => ({ ok: true }) } as any);

    await expect(sms.optOut('')).resolves.toEqual({ withdrawn: 0 });
  });
});

/** Bridge names and keys were written into served JS verbatim, and any plugin could add one. */
describe('runtime.registerModule', () => {
  it('needs extensions:manage', () => {
    expect(() => RuntimeModuleBridgeGuard.assert(allowed([]) as any, 'lib', ['Button'])).toThrow(/extensions:manage/);
  });

  it('refuses names and keys that are not module paths and identifiers', () => {
    const security = allowed(['extensions:manage']) as any;

    expect(() => RuntimeModuleBridgeGuard.assert(security, '@acme/ui', ['Button', 'useThing'])).not.toThrow();
    expect(() => RuntimeModuleBridgeGuard.assert(security, 'x";alert(1)//', ['Button'])).toThrow(/refused/);
    expect(() => RuntimeModuleBridgeGuard.assert(security, 'lib', ['a}; fetch("//evil")//'])).toThrow(/refused/);
  });
});
