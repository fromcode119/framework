import { EmailLogoUrl, EmailTemplateRegistry, FrameworkEmailSenderService, SystemConstants } from '@fromcode119/core';
import { FileShareEmailTemplate } from '@api/controllers/auth/email-templates/file-share-email-template';
import { EmailChangeVerificationTemplate } from '@api/controllers/auth/email-templates/email-change-verification-template';
import { PasswordResetEmailTemplate } from '@api/controllers/auth/email-templates/password-reset-email-template';
import { SecurityNotificationEmailTemplate } from '@api/controllers/auth/email-templates/security-notification-email-template';
import { VerifyEmailFallbackTemplate } from '@api/controllers/auth/email-templates/verify-email-fallback-template';
import { AuthEmailThemeOverride } from '@api/controllers/auth/email-templates/auth-email-theme-override';
import type { IAuthEmailCommonData } from '@api/controllers/auth/interfaces/auth-email-common-data.interface';
import { SecurityNotificationEvent } from '@api/controllers/auth/enums/security-notification-event.enum';
import { AuthControllerSignupEmailInfrastructure } from '@api/controllers/auth/auth-controller-infrastructure/auth-controller-signup-email-infrastructure';

export class AuthControllerEmailInfrastructure extends AuthControllerSignupEmailInfrastructure {
  protected async sendVerificationEmail(options: { to: string; verificationUrl: string; firstName?: string }): Promise<boolean> {
    const common = await this.emailCommonData(options.to, options.firstName);
    const fromAddress = (await this.resolveFrameworkSender()).identity;
    const brandedEmail = await this.buildBrandedVerifyEmail({
      verificationUrl: options.verificationUrl,
      firstName: common.user.firstName,
      brandName: common.appName,
      logoUrl: common.logoUrl,
      theme: common.theme,
    });
    const email = brandedEmail || await VerifyEmailFallbackTemplate.build({ ...common, verificationUrl: options.verificationUrl });

    return this.sendEmail({ to: options.to, ...email, from: fromAddress, sensitive: true, template: 'verify-email' }, '[AuthController] Failed to send verification email');
  }

  protected async sendPasswordResetEmail(options: { to: string; resetUrl: string; firstName?: string }): Promise<boolean> {
    const common = await this.emailCommonData(options.to, options.firstName);
    const fromAddress = (await this.resolveFrameworkSender()).identity;
    const email = await PasswordResetEmailTemplate.build({ ...common, resetUrl: options.resetUrl });

    return this.sendEmail({ to: options.to, ...email, from: fromAddress, sensitive: true, template: 'password-reset' }, '[AuthController] Failed to send password reset email');
  }

  protected async sendEmailChangeVerificationEmail(options: { to: string; confirmUrl: string; firstName?: string }): Promise<boolean> {
    const common = await this.emailCommonData(options.to, options.firstName);
    const fromAddress = (await this.resolveFrameworkSender()).identity;
    const email = await EmailChangeVerificationTemplate.build({ ...common, confirmUrl: options.confirmUrl, newEmail: options.to });

    return this.sendEmail({ to: options.to, ...email, from: fromAddress, sensitive: true, template: 'email-change' }, '[AuthController] Failed to send email-change verification email');
  }

  /**
   * What every framework email template receives: the site's name, the person, the site's theme
   * variables, and the language to write in — the site's own (Settings → Localization).
   */
  protected async emailCommonData(to: string, firstName?: string): Promise<IAuthEmailCommonData> {
    return {
      appName: await this.resolveFrameworkAppName(),
      logoUrl: await EmailLogoUrl.resolve(this.db, await this.getMetaValue(SystemConstants.META_KEY.EMAIL_LOGO), AuthEmailThemeOverride.activeSlug),
      user: { firstName: String(firstName || '').trim(), email: String(to || '').trim() },
      theme: await AuthEmailThemeOverride.variables(),
      locale: await this.resolvePlatformEmailLocale(),
    };
  }

  /**
   * "Something changed on your account." The caller names the EVENT and the facts it has; the
   * template for the reader's language writes the words.
   */
  protected async sendSecurityNotification(options: {
    userId: number;
    to: string;
    event: SecurityNotificationEvent;
    facts?: { ipAddress?: string; userAgent?: string; newEmail?: string; previousEmail?: string };
    firstName?: string;
    allowSilentFailure?: boolean;
  }) {
    // A security NOTIFICATION must never break the security ACTION that triggered it (login,
    // password/email change, SSO). Template-render failures (e.g. a missing template asset in a
    // published build) and send failures are best-effort side effects — isolate every failure here
    // so it can never propagate to the awaiting caller and surface as a failed login.
    try {
      const enabled = await this.getSettingBoolean(SystemConstants.META_KEY.AUTH_SECURITY_NOTIFICATIONS, true);
      if (!enabled) return;

      const fromAddress = (await this.resolveFrameworkSender()).identity;
      const email = await SecurityNotificationEmailTemplate.build({
        ...(await this.emailCommonData(options.to, options.firstName)),
        event: options.event,
        facts: options.facts || {},
      });
      const ok = await this.sendEmail({ to: options.to, from: fromAddress, ...email, template: 'security-notification' }, '[AuthController] Failed to send security notification');

      if (!ok && !options.allowSilentFailure) {
        await this.manager.writeLog(
          'WARN',
          `Security notification failed: ${options.event.value}`,
          'system',
          { userId: options.userId, email: options.to },
        ).catch(() => {});
      }
    } catch (error: any) {
      this.logger.error(`[AuthController] Security notification error (non-blocking): ${error?.message || error}`);
    }
  }

  /**
   * The platform's own emails, declared to the email catalog with when each goes out and the example
   * person and link its preview is drawn with. Called once, where the auth routes are built.
   */
  registerEmailCatalog(): void {
    const sample = { to: 'maria@example.com', firstName: 'Maria', url: 'https://example.com/…' };
    const common = () => this.emailCommonData(sample.to, sample.firstName);
    const entries: Array<[string, string, (data: Record<string, unknown>) => Promise<any>]> = [
      ['verify-email', 'verifyEmail', async () => {
        const base = await common();
        return (await this.buildBrandedVerifyEmail({ verificationUrl: sample.url, firstName: sample.firstName, brandName: base.appName, logoUrl: base.logoUrl, theme: base.theme }))
          || VerifyEmailFallbackTemplate.build({ ...base, verificationUrl: sample.url });
      }],
      ['password-reset', 'passwordReset', async () => PasswordResetEmailTemplate.build({ ...(await common()), resetUrl: sample.url })],
      ['email-change', 'emailChange', async () => EmailChangeVerificationTemplate.build({ ...(await common()), confirmUrl: sample.url, newEmail: sample.to })],
      ['security-notification', 'securityNotification', async () => SecurityNotificationEmailTemplate.build({ ...(await common()), event: SecurityNotificationEvent.PASSWORD_CHANGED, facts: {} })],
      ['file-share', 'fileShare', async () => {
        const base = await common();
        return FileShareEmailTemplate.build({ appName: base.appName, logoUrl: base.logoUrl, title: 'Q3 report.pdf', message: '', shareUrl: sample.url, expiresAt: '', maxDownloads: '', locale: base.locale, theme: base.theme });
      }],
    ];
    for (const [key, words, render] of entries) {
      EmailTemplateRegistry.register('', {
        key,
        labelKey: `emails.catalog.platform.${words}.label`,
        triggerKey: `emails.catalog.platform.${words}.trigger`,
        sensitive: key !== 'security-notification',
        sample: { to: sample.to, firstName: sample.firstName },
        method: '',
      }, render);
    }
  }

  protected async sendEmail(payload: { to: string; from: string; subject: string; text: string; html: string; sensitive?: boolean; template?: string }, logPrefix: string): Promise<boolean> {
    // ONE guard for every framework email. Without a configured sender the platform used to invent
    // `no-reply@<site domain>` and send anyway — an unroutable address on a domain nobody nominated
    // for mail. Refusing here is honest and, unlike the invented address, it says what to fix.
    if (!String(payload.from || '').trim()) {
      this.logger.error(
        `${logPrefix}: no sender address is configured. Set ${FrameworkEmailSenderService.SETTING_HINT}.`,
      );
      return false;
    }

    try {
      await this.manager.email.send(payload);
      return true;
    } catch (error: any) {
      this.logger.error(`${logPrefix}: ${error?.message || error}`);
      return false;
    }
  }

  protected async getSettingBoolean(_key: string, defaultValue: boolean): Promise<boolean> {
    return defaultValue;
  }
}
