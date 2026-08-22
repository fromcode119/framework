import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { FrameworkEmailSenderService } from '@core/email/framework-email-sender-service';

/**
 * The framework used to build `no-reply@<platform domain>` when no sender was configured. That
 * address was invented by code — no admin control produced it, the operator could not change it, and
 * it silently outranked an explicitly configured `EMAIL_FROM`. It also made the site's domain a
 * mail-sending domain by implication, which is how a correct "this domain sends no mail" SPF/DMARC
 * policy came to contradict the platform's own password-reset emails.
 *
 * These pin the order and, most importantly, that the unconfigured case stays EMPTY.
 */
describe('FrameworkEmailSenderService', () => {
  const ENV_KEYS = ['EMAIL_FROM', 'SMTP_FROM', 'EMAIL_FROM_NAME'];
  let saved: Record<string, string | undefined>;

  /** An integration manager whose stored email config is `config`. */
  function integrations(config: Record<string, unknown> | null) {
    return { getConfig: async () => (config ? { stored: { providerKey: 'smtp', config } } : null) };
  }

  beforeEach(() => {
    saved = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]));
    ENV_KEYS.forEach((key) => delete process.env[key]);
  });

  afterEach(() => {
    ENV_KEYS.forEach((key) => {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key] as string;
    });
  });

  it('uses the address configured on the Email Delivery integration', async () => {
    const sender = await FrameworkEmailSenderService.resolve(
      integrations({ fromAddress: 'orders@shop.example', fromName: 'Shop' }),
      'Platform',
    );

    expect(sender.isConfigured).toBe(true);
    expect(sender.address).toBe('orders@shop.example');
    expect(sender.identity).toBe('"Shop" <orders@shop.example>');
  });

  it('falls back to the platform name when the integration sets no From Name', async () => {
    const sender = await FrameworkEmailSenderService.resolve(
      integrations({ fromAddress: 'orders@shop.example' }),
      'Вселенски портал',
    );

    expect(sender.identity).toBe('"Вселенски портал" <orders@shop.example>');
  });

  it('falls back to EMAIL_FROM when the integration has no sender', async () => {
    process.env.EMAIL_FROM = 'env@shop.example';

    const sender = await FrameworkEmailSenderService.resolve(integrations({ host: 'smtp.example' }), 'Platform');

    expect(sender.address).toBe('env@shop.example');
  });

  it('accepts SMTP_FROM as the alias of EMAIL_FROM', async () => {
    process.env.SMTP_FROM = 'legacy@shop.example';

    const sender = await FrameworkEmailSenderService.resolve(null, 'Platform');

    expect(sender.address).toBe('legacy@shop.example');
  });

  it('prefers the CONFIGURED integration address over the environment', async () => {
    // The old resolver had this backwards: a value derived from the site domain beat the explicit
    // env setting, so an operator who configured a sender was ignored without being told.
    process.env.EMAIL_FROM = 'env@shop.example';

    const sender = await FrameworkEmailSenderService.resolve(
      integrations({ fromAddress: 'configured@shop.example' }),
      'Platform',
    );

    expect(sender.address).toBe('configured@shop.example');
  });

  it('returns an UNCONFIGURED sender rather than inventing one', async () => {
    const sender = await FrameworkEmailSenderService.resolve(integrations(null), 'Вселенски портал');

    expect(sender.isConfigured).toBe(false);
    expect(sender.address).toBe('');
    // The specific regression: no mailbox conjured from the site's domain, and no `localhost`.
    expect(sender.identity).not.toMatch(/no-reply@/);
    expect(sender.identity).not.toMatch(/localhost/);
  });

  it('survives an integration read that throws', async () => {
    const broken = { getConfig: async () => { throw new Error('db down'); } };
    process.env.EMAIL_FROM = 'env@shop.example';

    const sender = await FrameworkEmailSenderService.resolve(broken, 'Platform');

    expect(sender.address).toBe('env@shop.example');
  });

  it('escapes a quote in the display name so the header stays valid', async () => {
    const sender = await FrameworkEmailSenderService.resolve(
      integrations({ fromAddress: 'a@b.example', fromName: 'The "Shop"' }),
      'Platform',
    );

    expect(sender.identity).toBe('"The \\"Shop\\"" <a@b.example>');
  });
});
