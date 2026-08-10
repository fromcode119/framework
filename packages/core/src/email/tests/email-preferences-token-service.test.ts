import { describe, expect, it } from 'vitest';
import { EmailPreferencesTokenService } from '@core/email/email-preferences-token-service';

/**
 * The framework's own capability link for the global preferences page.
 *
 * Each mailing plugin already mints a token for ITS stream, which is exactly why a cross-plugin page
 * cannot use one: a page listing every declared stream would have to know which plugin issued the link
 * and ask it to verify — the cross-plugin coupling the architecture forbids. The suppression list is
 * framework-owned, so the token that governs it is too.
 *
 * Signed over the ADDRESS, because what it authorises is "change the mail settings for this person".
 * There is no id in it: an id in a link is something anyone can enumerate.
 */
describe('EmailPreferencesTokenService', () => {
  const SECRET = 'a'.repeat(64);
  const OTHER = 'b'.repeat(64);

  it('round-trips the address, lower-cased and trimmed', () => {
    const token = EmailPreferencesTokenService.generate('  Reader@Example.COM ', SECRET);
    expect(EmailPreferencesTokenService.resolveAddress(token, SECRET)).toBe('reader@example.com');
  });

  it('rejects a token signed with a different key', () => {
    const token = EmailPreferencesTokenService.generate('reader@example.com', OTHER);
    expect(EmailPreferencesTokenService.resolveAddress(token, SECRET)).toBeNull();
  });

  it("rejects someone else's address carrying a valid signature", () => {
    const mine = EmailPreferencesTokenService.generate('a@example.com', SECRET);
    const theirs = EmailPreferencesTokenService.generate('b@example.com', SECRET);
    const forged = `${theirs.split('.')[0]}.${mine.split('.')[1]}`;
    expect(EmailPreferencesTokenService.resolveAddress(forged, SECRET)).toBeNull();
  });

  it('rejects a malformed, unsigned or empty token', () => {
    for (const bad of ['', 'not-a-token', 'a.b.c', EmailPreferencesTokenService.generate('a@b.com', SECRET).split('.')[0]]) {
      expect(EmailPreferencesTokenService.resolveAddress(bad, SECRET)).toBeNull();
    }
  });

  it('refuses to verify when no key is available, rather than passing', () => {
    const token = EmailPreferencesTokenService.generate('reader@example.com', SECRET);
    expect(EmailPreferencesTokenService.resolveAddress(token, '')).toBeNull();
  });

  it('refuses to MINT an unsigned token when no key is available', () => {
    expect(() => EmailPreferencesTokenService.generate('reader@example.com', '')).toThrow();
  });

  /** The purpose is what stops this being replayable as a review-request or campaign link. */
  it('derives under its own purpose, distinct from any plugin capability', () => {
    expect(EmailPreferencesTokenService.PURPOSE).toBe('system.email-preferences');
  });
});
