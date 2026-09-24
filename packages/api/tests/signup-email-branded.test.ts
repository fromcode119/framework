import { describe, it, expect } from 'vitest';
import { SystemConstants } from '@fromcode119/core';
import { AuthControllerSignupEmailInfrastructure } from '@api/controllers/auth/auth-controller-infrastructure/auth-controller-signup-email-infrastructure';

/** A site's own Settings → General → Sign-up email rows, and nothing else — no theme is consulted. */
class Probe extends AuthControllerSignupEmailInfrastructure {
  constructor(private readonly meta: Record<string, string>) {
    super({} as any, {} as any);
  }

  protected async getMetaValue(key: string): Promise<string | null> {
    return key in this.meta ? this.meta[key] : null;
  }

  build(firstName = '') {
    return this.buildBrandedVerifyEmail({ verificationUrl: 'https://site.test/verify?t=1', firstName, brandName: 'Вселенски Портал' });
  }
}

const K = SystemConstants.META_KEY;

describe('the branded sign-up email', () => {
  it('is not sent while Branded sign-up email is off — the plain email goes instead', async () => {
    expect(await new Probe({ [K.SIGNUP_EMAIL_BRANDED]: 'false', [K.SIGNUP_EMAIL_TITLE]: 'Ignored' }).build()).toBeNull();
    expect(await new Probe({}).build()).toBeNull();
  });

  it("uses the site's copy, with the brand and the visitor's name filled in", async () => {
    const email = await new Probe({
      [K.SIGNUP_EMAIL_BRANDED]: 'true',
      [K.SIGNUP_EMAIL_SUBJECT]: '{{brandName}}: Потвърди своя имейл',
      [K.SIGNUP_EMAIL_GREETING]: 'Здравей{{firstNameSuffix}}',
      [K.SIGNUP_EMAIL_ACCENT_COLOR]: '#8B5CF6',
    }).build('Ани');
    expect(email!.subject).toBe('Вселенски Портал: Потвърди своя имейл');
    expect(email!.html).toContain('Здравей, Ани');
    expect(email!.html).toContain('#8B5CF6');
  });

  it('sends the declared default for a line the site left empty', async () => {
    const email = await new Probe({ [K.SIGNUP_EMAIL_BRANDED]: 'true', [K.SIGNUP_EMAIL_TITLE]: '   ' }).build();
    expect(email!.html).toContain('Verify your email address');
    expect(email!.subject).toBe('Вселенски Портал: Verify your email');
  });
});
