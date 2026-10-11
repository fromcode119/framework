import { createHash, randomInt, timingSafeEqual } from 'crypto';
import Handlebars from 'handlebars';
import { LocalizationUtils, MetaContextProxy, SystemConstants } from '@fromcode119/core';
import { AuthEmailTemplateFileService } from '@api/controllers/auth/email-templates/auth-email-template-file-service';

/**
 * Proof that a person holds the number they want texts sent to.
 *
 * An agreement to texts used to take any number typed in, so anyone with an account could have the
 * site text a stranger — at the site's cost, under its name. Now the number first receives a code, and
 * the agreement is recorded only once that code comes back. The code is kept as a hash with the number
 * it was sent to, in the site's own settings rows, and is single-use, short-lived and tried a few times
 * at most. The words of the text come from the `phone-verification.txt` template in the site's language.
 */
export class PhoneVerificationService {
  private static readonly CODE_MINUTES = 10;
  private static readonly RESEND_SECONDS = 60;
  private static readonly MAX_TRIES = 5;

  constructor(private readonly manager: any) {} // eslint-disable-line @typescript-eslint/no-explicit-any

  /** Texts a fresh code to `phone` — unless one went to the same number under a minute ago. */
  async start(userId: number, phone: string, sender: { send(message: { to: string; body: string }): Promise<unknown> }): Promise<void> {
    const pending = await this.read(userId);
    if (pending && pending.phone === phone && Date.now() - pending.sentAt < PhoneVerificationService.RESEND_SECONDS * 1000) return;
    const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
    await sender.send({ to: phone, body: await this.message(code) });
    await this.meta.set(this.key(userId), JSON.stringify({
      phone,
      hash: PhoneVerificationService.hash(userId, phone, code),
      sentAt: Date.now(),
      expiresAt: Date.now() + PhoneVerificationService.CODE_MINUTES * 60 * 1000,
      tries: 0,
    }));
  }

  /** True once, for the code last sent to this number; every wrong guess uses up a try. */
  async confirm(userId: number, phone: string, code: string): Promise<boolean> {
    const pending = await this.read(userId);
    if (!pending || pending.phone !== phone || pending.expiresAt < Date.now() || pending.tries >= PhoneVerificationService.MAX_TRIES) return false;
    const expected = Buffer.from(pending.hash, 'hex');
    const given = Buffer.from(PhoneVerificationService.hash(userId, phone, String(code ?? '').replace(/\D/g, '')), 'hex');
    if (expected.length === given.length && timingSafeEqual(expected, given)) {
      await this.meta.set(this.key(userId), '');
      return true;
    }
    await this.meta.set(this.key(userId), JSON.stringify({ ...pending, tries: pending.tries + 1 }));
    return false;
  }

  private get meta() {
    return MetaContextProxy.createMetaProxy(this.manager);
  }

  private key(userId: number): string {
    return `user:${userId}:phone_verification`;
  }

  private async read(userId: number): Promise<{ phone: string; hash: string; sentAt: number; expiresAt: number; tries: number } | null> {
    try {
      const parsed = JSON.parse(String((await this.meta.get(this.key(userId))) || 'null'));
      return parsed && typeof parsed.hash === 'string' ? parsed : null;
    } catch {
      return null;
    }
  }

  private async message(code: string): Promise<string> {
    const locale = LocalizationUtils.normalizeLocaleCode(
      String((await this.meta.get(SystemConstants.META_KEY.FRONTEND_DEFAULT_LOCALE)) || (await this.meta.get(SystemConstants.META_KEY.DEFAULT_LOCALE)) || ''),
    );
    const template = await AuthEmailTemplateFileService.readTemplate('phone-verification.txt', locale);
    return Handlebars.compile(template, { noEscape: true })({ code, minutes: PhoneVerificationService.CODE_MINUTES }).trim();
  }

  private static hash(userId: number, phone: string, code: string): string {
    return createHash('sha256').update(`${userId}:${phone}:${code}`).digest('hex');
  }
}
