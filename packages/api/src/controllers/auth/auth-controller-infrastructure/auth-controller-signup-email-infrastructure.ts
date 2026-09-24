import { CoercionUtils, LocalizationUtils, SystemConstants, SystemSettingRegistry } from '@fromcode119/core';
import { BrandedVerifyEmailTemplate } from '@api/controllers/auth/email-templates/branded-verify-email-template';
import { AuthControllerUrlInfrastructure } from '@api/controllers/auth/auth-controller-infrastructure/auth-controller-url-infrastructure';

/**
 * The branded sign-up email, built from the SITE's own copy in Settings → General → Sign-up email.
 *
 * It used to be built from `settings.authEmails` in the active theme's config — looked up on the
 * PLATFORM's `_system_themes` row, so on a multi-site deployment no site's copy was ever read and every
 * site got the plain email, while the copy sat in a blob no screen could edit.
 */
export class AuthControllerSignupEmailInfrastructure extends AuthControllerUrlInfrastructure {
  /** `null` when the site sends the plain email (Branded sign-up email off). */
  protected async buildBrandedVerifyEmail(options: {
    verificationUrl: string;
    firstName?: string;
    brandName: string;
  }): Promise<{ subject: string; text: string; html: string } | null> {
    const branded = CoercionUtils.toBoolean(await this.readSignupSetting(SystemConstants.META_KEY.SIGNUP_EMAIL_BRANDED), false);
    if (!branded) {
      return null;
    }

    const firstName = String(options.firstName || '').trim();
    const tokens = {
      brandName: options.brandName,
      firstName,
      // `, John` / '' — the token the greeting is written against.
      firstNameSuffix: firstName ? `, ${firstName}` : '',
      year: String(new Date().getFullYear()),
    };
    const copy = async (key: typeof SystemConstants.META_KEY[keyof typeof SystemConstants.META_KEY]) =>
      this.applyEmailTokens(await this.readSignupSetting(key), tokens);

    return BrandedVerifyEmailTemplate.build({
      lang: await this.resolvePlatformEmailLocale(),
      subject: await copy(SystemConstants.META_KEY.SIGNUP_EMAIL_SUBJECT),
      greeting: await copy(SystemConstants.META_KEY.SIGNUP_EMAIL_GREETING),
      title: await copy(SystemConstants.META_KEY.SIGNUP_EMAIL_TITLE),
      message: await copy(SystemConstants.META_KEY.SIGNUP_EMAIL_MESSAGE),
      buttonLabel: await copy(SystemConstants.META_KEY.SIGNUP_EMAIL_BUTTON_LABEL),
      fallbackLabel: await copy(SystemConstants.META_KEY.SIGNUP_EMAIL_FALLBACK_LABEL),
      ignoreMessage: await copy(SystemConstants.META_KEY.SIGNUP_EMAIL_IGNORE_MESSAGE),
      footerText: await copy(SystemConstants.META_KEY.SIGNUP_EMAIL_FOOTER_TEXT),
      accentColor: await this.readSignupSetting(SystemConstants.META_KEY.SIGNUP_EMAIL_ACCENT_COLOR),
      verificationUrl: options.verificationUrl,
    });
  }

  /**
   * The `lang` attribute of the rendered email. Driven by the platform's configured locale (admin
   * Settings → Localization) — the storefront default first, then the platform default. It used to be
   * a hardcoded `lang="bg"` in the template, on every verification email the framework sent.
   */
  protected async resolvePlatformEmailLocale(): Promise<string> {
    const configured = await this.getMetaValue(SystemConstants.META_KEY.FRONTEND_DEFAULT_LOCALE)
      || await this.getMetaValue(SystemConstants.META_KEY.DEFAULT_LOCALE);
    return LocalizationUtils.normalizeLocaleCode(configured || '');
  }

  /**
   * The site's value, or the setting's declared default when the site has none — the same default the
   * Sign-up email card shows as the empty field's placeholder, so an empty box is never a mystery.
   */
  private async readSignupSetting(key: typeof SystemConstants.META_KEY[keyof typeof SystemConstants.META_KEY]): Promise<string> {
    const stored = String((await this.getMetaValue(key)) ?? '').trim();
    return stored || SystemSettingRegistry.defaultValueOf(key).trim();
  }

  private applyEmailTokens(template: string, tokens: Record<string, string>): string {
    return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_match, key) => tokens[key] || '');
  }
}
