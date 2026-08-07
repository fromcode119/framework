import { LocalizationUtils, SystemConstants } from '@fromcode119/core';
import { ThemedVerifyEmailTemplate } from '@api/controllers/auth/email-templates/themed-verify-email-template';
import { ThemedVerifyEmailDefaultsService } from '@api/controllers/auth/email-templates/themed-verify-email-defaults-service';
import { AuthControllerUrlInfrastructure } from '@api/controllers/auth/auth-controller-infrastructure/auth-controller-url-infrastructure';

export class AuthControllerThemeEmailInfrastructure extends AuthControllerUrlInfrastructure {
  protected async buildThemeVerifyEmail(options: {
    verificationUrl: string;
    firstName?: string;
    fallbackAppName: string;
  }): Promise<{ subject: string; text: string; html: string } | null> {
    const themeSettings = await this.resolveThemeAuthEmailSettings();
    if (!Object.keys(themeSettings).length) {
      return null;
    }

    const themeVariables = await this.resolveActiveThemeVariables();
    const verifyEmailSettings = this.parseThemeConfigObject(themeSettings.verifyEmail);
    // Framework defaults live in `templates/themed-verify-email.defaults.json`, never as literals here.
    const defaults = await ThemedVerifyEmailDefaultsService.read();
    const firstName = String(options.firstName || '').trim();
    const brandName = this.readThemeConfigString(themeSettings.brandName)
      || this.readThemeConfigString(themeVariables.siteName)
      || options.fallbackAppName;
    const tokens = {
      brandName,
      firstName,
      // `, John` / '' — the token contract themes already write their greeting against. Unchanged.
      firstNameSuffix: firstName ? `, ${firstName}` : '',
      year: String(new Date().getFullYear()),
    };
    const accentColor = this.readThemeConfigString(themeSettings.accentColor) || defaults.accentColor;
    const footerText = this.applyThemeEmailTokens(
      this.readThemeConfigString(themeSettings.footerText)
        || this.readThemeConfigString(themeVariables.footerCopyright)
        || defaults.footerText,
      tokens,
    );
    const logoUrl = this.resolveThemeAssetUrl(
      this.readUrlOrigin(options.verificationUrl),
      this.readThemeConfigString(themeSettings.logoUrl),
    );
    return ThemedVerifyEmailTemplate.build({
      lang: await this.resolvePlatformEmailLocale(),
      subject: this.applyThemeEmailTokens(this.readThemeConfigString(verifyEmailSettings.subject) || defaults.subject, tokens),
      greeting: this.applyThemeEmailTokens(this.readThemeConfigString(verifyEmailSettings.greeting) || defaults.greeting, tokens),
      title: this.applyThemeEmailTokens(this.readThemeConfigString(verifyEmailSettings.title) || defaults.title, tokens),
      message: this.applyThemeEmailTokens(this.readThemeConfigString(verifyEmailSettings.message) || defaults.message, tokens),
      buttonLabel: this.applyThemeEmailTokens(this.readThemeConfigString(verifyEmailSettings.buttonLabel) || defaults.buttonLabel, tokens),
      fallbackLabel: this.applyThemeEmailTokens(this.readThemeConfigString(verifyEmailSettings.fallbackLabel) || defaults.fallbackLabel, tokens),
      ignoreMessage: this.applyThemeEmailTokens(this.readThemeConfigString(verifyEmailSettings.ignoreMessage) || defaults.ignoreMessage, tokens),
      footerText,
      verificationUrl: options.verificationUrl,
      accentColor,
      brandName,
      logoUrl,
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

  protected async resolveThemeAuthEmailSettings(): Promise<Record<string, unknown>> {
    const themeConfig = await this.resolveActiveThemeConfig();
    const themeSettings = this.parseThemeConfigObject(themeConfig.settings);
    return this.parseThemeConfigObject(themeSettings.authEmails || themeConfig.authEmails);
  }

  protected async resolveActiveThemeVariables(): Promise<Record<string, unknown>> {
    const themeConfig = await this.resolveActiveThemeConfig();
    return this.parseThemeConfigObject(themeConfig.variables);
  }

  protected async resolveActiveThemeConfig(): Promise<Record<string, unknown>> {
    try {
      const activeTheme = await this.db.findOne('_system_themes', { state: 'active' });
      return this.parseThemeConfigObject(activeTheme?.config);
    } catch {
      return {};
    }
  }

  protected parseThemeConfigObject(value: unknown): Record<string, unknown> {
    if (!value) {
      return {};
    }

    if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          return parsed as Record<string, unknown>;
        }
      } catch {
        return {};
      }

      return {};
    }

    if (typeof value === 'object' && !Array.isArray(value)) {
      return value as Record<string, unknown>;
    }

    return {};
  }

  protected readThemeConfigString(value: unknown): string {
    return typeof value === 'string' ? value.trim() : '';
  }

  protected applyThemeEmailTokens(template: string, tokens: Record<string, string>): string {
    return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_match, key) => tokens[key] || '');
  }

  protected readUrlOrigin(value: string): string {
    try {
      return new URL(value).origin;
    } catch {
      return '';
    }
  }

  protected resolveThemeAssetUrl(origin: string, value: string): string {
    if (!value) {
      return '';
    }

    if (/^https?:\/\//i.test(value)) {
      return value;
    }

    if (!origin) {
      return value;
    }

    return `${origin.replace(/\/+$/, '')}/${value.replace(/^\/+/, '')}`;
  }
}
