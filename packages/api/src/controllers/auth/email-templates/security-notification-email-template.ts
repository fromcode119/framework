import { AuthEmailTemplateRenderService } from '@api/controllers/auth/email-templates/auth-email-template-render-service';
import type { IAuthEmailCommonData } from '@api/controllers/auth/interfaces/auth-email-common-data.interface';
import type { SecurityNotificationEvent } from '@api/controllers/auth/enums/security-notification-event.enum';

/**
 * "Something changed on your account." The sender names WHAT happened and the facts it knows; the
 * template — in the reader's language, a theme's copy first — writes the subject, the sentence and the
 * lines. They used to be English sentences built in code, so every site sent them in English.
 */
export class SecurityNotificationEmailTemplate {
  static build(options: IAuthEmailCommonData & {
    event: SecurityNotificationEvent;
    facts: { ipAddress?: string; userAgent?: string; newEmail?: string; previousEmail?: string };
  }): Promise<{ subject: string; text: string; html: string }> {
    const now = new Date();
    let time = now.toISOString();
    try {
      // `timeStyle: 'long'` carries the zone ("UTC"); `timeZoneName` cannot be combined with the styles.
      time = now.toLocaleString(options.locale || undefined, { dateStyle: 'long', timeStyle: 'long', timeZone: 'UTC' });
    } catch {
      // An unknown locale tag keeps the ISO time rather than losing the line.
    }
    return AuthEmailTemplateRenderService.renderEmail('security-notification', {
      ...options,
      // `event.passwordChanged` etc. — one flag per event, so a template can branch without helpers.
      event: { name: options.event.value, [options.event.value]: true },
      facts: { ...options.facts, time, timeIso: now.toISOString() },
    }, options.locale);
  }
}
