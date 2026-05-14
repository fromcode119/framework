import { ThemedVerifyEmailTemplate } from '../email-templates/themed-verify-email-template';
import { AuthControllerUrlInfrastructure } from './auth-controller-url-infrastructure';

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
    const firstName = String(options.firstName || '').trim();
    const brandName = this.readThemeConfigString(themeSettings.brandName)
      || this.readThemeConfigString(themeVariables.siteName)
      || options.fallbackAppName;
    const accentColor = this.readThemeConfigString(themeSettings.accentColor) || '#8B5CF6';
    const footerText = this.readThemeConfigString(themeSettings.footerText)
      || this.readThemeConfigString(themeVariables.footerCopyright)
      || `© ${new Date().getFullYear()} ${brandName}. All rights reserved.`;
    const logoUrl = this.resolveThemeAssetUrl(
      this.readUrlOrigin(options.verificationUrl),
      this.readThemeConfigString(themeSettings.logoUrl),
    );
    const greeting = this.applyThemeEmailTokens(
      this.readThemeConfigString(verifyEmailSettings.greeting) || 'Здравей{{firstNameSuffix}}',
      {
        brandName,
        firstName,
        firstNameSuffix: firstName ? `, ${firstName}` : '',
      },
    );
    const title = this.applyThemeEmailTokens(
      this.readThemeConfigString(verifyEmailSettings.title) || 'Потвърди своя имейл адрес',
      { brandName, firstName },
    );
    const message = this.applyThemeEmailTokens(
      this.readThemeConfigString(verifyEmailSettings.message)
        || 'Остава само една стъпка, за да активираш профила си и да получаваш важни известия от {{brandName}}.',
      { brandName, firstName },
    );
    const buttonLabel = this.applyThemeEmailTokens(
      this.readThemeConfigString(verifyEmailSettings.buttonLabel) || 'Потвърди имейла',
      { brandName, firstName },
    );
    const fallbackLabel = this.applyThemeEmailTokens(
      this.readThemeConfigString(verifyEmailSettings.fallbackLabel) || 'Ако бутонът не работи, копирай този адрес в браузъра си:',
      { brandName, firstName },
    );
    const ignoreMessage = this.applyThemeEmailTokens(
      this.readThemeConfigString(verifyEmailSettings.ignoreMessage) || 'Ако не си създавал този профил, можеш спокойно да игнорираш това писмо.',
      { brandName, firstName },
    );
    const subject = this.applyThemeEmailTokens(
      this.readThemeConfigString(verifyEmailSettings.subject) || '{{brandName}}: Потвърди своя имейл',
      { brandName, firstName },
    );
    return ThemedVerifyEmailTemplate.build({
      subject,
      greeting,
      title,
      message,
      buttonLabel,
      fallbackLabel,
      ignoreMessage,
      footerText,
      verificationUrl: options.verificationUrl,
      accentColor,
      brandName,
      logoUrl,
    });
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
