import { SystemConstants } from '@fromcode119/core';
import { EmailChangeVerificationTemplate } from '../email-templates/email-change-verification-template';
import { PasswordResetEmailTemplate } from '../email-templates/password-reset-email-template';
import { SecurityNotificationEmailTemplate } from '../email-templates/security-notification-email-template';
import { VerifyEmailFallbackTemplate } from '../email-templates/verify-email-fallback-template';
import { AuthControllerThemeEmailInfrastructure } from './auth-controller-theme-email-infrastructure';

export class AuthControllerEmailInfrastructure extends AuthControllerThemeEmailInfrastructure {
  protected async sendVerificationEmail(options: { to: string; verificationUrl: string; firstName?: string }): Promise<boolean> {
    const recipientName = String(options.firstName || '').trim();
    const appName = await this.resolveFrameworkAppName();
    const fromAddress = await this.resolveFrameworkSenderIdentity();
    const themedEmail = await this.buildThemeVerifyEmail({
      verificationUrl: options.verificationUrl,
      firstName: recipientName,
      fallbackAppName: appName,
    });
    const greeting = recipientName ? `Hi ${recipientName},` : 'Hi,';
    const fallbackEmail = await VerifyEmailFallbackTemplate.build({
      appName,
      greeting,
      verificationUrl: options.verificationUrl,
    });
    const subject = themedEmail?.subject || fallbackEmail.subject;
    const text = themedEmail?.text || fallbackEmail.text;
    const html = themedEmail?.html || fallbackEmail.html;

    return this.sendEmail({ to: options.to, subject, text, html, from: fromAddress }, '[AuthController] Failed to send verification email');
  }

  protected async sendPasswordResetEmail(options: { to: string; resetUrl: string; firstName?: string }): Promise<boolean> {
    const recipientName = String(options.firstName || '').trim();
    const greeting = recipientName ? `Hi ${recipientName},` : 'Hi,';
    const appName = await this.resolveFrameworkAppName();
    const fromAddress = await this.resolveFrameworkSenderIdentity();
    const email = await PasswordResetEmailTemplate.build({ appName, greeting, resetUrl: options.resetUrl });

    return this.sendEmail({ to: options.to, subject: email.subject, text: email.text, html: email.html, from: fromAddress }, '[AuthController] Failed to send password reset email');
  }

  protected async sendEmailChangeVerificationEmail(options: { to: string; confirmUrl: string; firstName?: string }): Promise<boolean> {
    const recipientName = String(options.firstName || '').trim();
    const greeting = recipientName ? `Hi ${recipientName},` : 'Hi,';
    const appName = await this.resolveFrameworkAppName();
    const fromAddress = await this.resolveFrameworkSenderIdentity();
    const email = await EmailChangeVerificationTemplate.build({ appName, greeting, confirmUrl: options.confirmUrl });

    return this.sendEmail({ to: options.to, subject: email.subject, text: email.text, html: email.html, from: fromAddress }, '[AuthController] Failed to send email-change verification email');
  }

  protected async sendSecurityNotification(options: {
    userId: number;
    to: string;
    subject: string;
    title: string;
    details?: string[];
    allowSilentFailure?: boolean;
  }) {
    const enabled = await this.getSettingBoolean(SystemConstants.META_KEY.AUTH_SECURITY_NOTIFICATIONS, true);
    if (!enabled) return;

    const appName = await this.resolveFrameworkAppName();
    const fromAddress = await this.resolveFrameworkSenderIdentity();
    const details = Array.isArray(options.details) ? options.details.filter(Boolean) : [];
    const email = await SecurityNotificationEmailTemplate.build({
      appName,
      subject: options.subject,
      title: options.title,
      details,
    });
    const ok = await this.sendEmail({
      to: options.to,
      from: fromAddress,
      subject: email.subject,
      text: email.text,
      html: email.html,
    }, '[AuthController] Failed to send security notification');

    if (!ok && !options.allowSilentFailure) {
      await this.manager.writeLog(
        'WARN',
        `Security notification failed: ${options.subject}`,
        'system',
        { userId: options.userId, email: options.to },
      ).catch(() => {});
    }
  }

  protected async sendEmail(payload: { to: string; from: string; subject: string; text: string; html: string }, logPrefix: string): Promise<boolean> {
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
