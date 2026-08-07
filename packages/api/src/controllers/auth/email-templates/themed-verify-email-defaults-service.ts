import { CoercionUtils } from '@fromcode119/core';
import { AuthEmailTemplateFileService } from '@api/controllers/auth/email-templates/auth-email-template-file-service';

/**
 * Loads the framework's default copy + accent for the themed verification email from its template
 * file. The seven strings and the accent colour used to be literals inside
 * `auth-controller-theme-email-infrastructure.ts` — and they were Bulgarian, so EVERY platform on
 * EVERY language sent a Bulgarian verification email the moment its theme set any `authEmails` key.
 * Copy belongs in the template files, the theme's `authEmails` settings override it.
 */
export class ThemedVerifyEmailDefaultsService {
  private static readonly TEMPLATE_FILE = 'themed-verify-email.defaults.json';

  private static cached: Record<string, string> | null = null;

  static async read(): Promise<Record<string, string>> {
    if (ThemedVerifyEmailDefaultsService.cached) {
      return ThemedVerifyEmailDefaultsService.cached;
    }

    const raw = await AuthEmailTemplateFileService.readTemplate(ThemedVerifyEmailDefaultsService.TEMPLATE_FILE);
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const defaults: Record<string, string> = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (key.startsWith('_')) continue;
      defaults[key] = CoercionUtils.toString(value);
    }
    ThemedVerifyEmailDefaultsService.cached = defaults;
    return defaults;
  }
}
