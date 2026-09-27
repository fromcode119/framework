import { promises as fs } from 'fs';
import path from 'path';
import { AuthEmailThemeOverride } from '@api/controllers/auth/email-templates/auth-email-theme-override';

/**
 * Loads an email template, preferring the recipient's language.
 *
 * Every framework email — password reset, address verification, security alerts, a shared-file link —
 * used to load exactly one file per template, so they were English on every install regardless of the
 * platform's configured locale. A Bulgarian site sent Bulgarian pages and English email.
 *
 * ## Layout
 *
 * One FOLDER per language, `en/` being the complete set:
 *
 *   templates/en/password-reset.html      ← always present
 *   templates/bg/password-reset.html      ← present once translated
 *
 * Folders rather than a `password-reset.bg.html` suffix beside the original: a translator opening this
 * directory should see one place to copy and translate, not a list where the English and the partial
 * translations are interleaved and it is impossible to tell at a glance what still needs doing.
 *
 * Falling back to `en/` is deliberate rather than a failure — a language can be added one template at a
 * time, and a missing translation sends readable English instead of nothing.
 */
export class AuthEmailTemplateFileService {
  /** The complete set. Every other language is a partial overlay on this one. */
  private static readonly BASE_LOCALE = 'en';

  /**
   * @param locale e.g. `bg` or `bg-BG`. Region is dropped — nothing here is region-specific.
   *
   * Looked up in this order: the active theme's copy in the reader's language, the framework's in
   * that language, then the theme's English, then the framework's English. A theme only has to ship
   * the files it changes.
   */
  static async readTemplate(relativePath: string, locale?: string): Promise<string> {
    const name = String(relativePath || '').replace(/^\/+/, '');
    const language = AuthEmailTemplateFileService.normalizeLocale(locale);
    const languages = language && language !== AuthEmailTemplateFileService.BASE_LOCALE
      ? [language, AuthEmailTemplateFileService.BASE_LOCALE]
      : [AuthEmailTemplateFileService.BASE_LOCALE];

    for (const lang of languages) {
      const fromTheme = await AuthEmailTemplateFileService.tryThemeRead(path.posix.join(lang, name));
      if (fromTheme !== null) return fromTheme;
      if (lang === AuthEmailTemplateFileService.BASE_LOCALE) break;
      const translated = await AuthEmailTemplateFileService.tryRead(path.posix.join(lang, name));
      if (translated !== null) return translated;
    }

    return AuthEmailTemplateFileService.readOrThrow(path.posix.join(AuthEmailTemplateFileService.BASE_LOCALE, name));
  }

  private static async tryThemeRead(relativePath: string): Promise<string | null> {
    const root = AuthEmailThemeOverride.root();
    if (!root) return null;
    try {
      return await fs.readFile(path.join(root, relativePath), 'utf-8');
    } catch {
      return null;
    }
  }

  private static normalizeLocale(locale?: string): string {
    return String(locale || '').trim().toLowerCase().split('-')[0];
  }

  private static async tryRead(relativePath: string): Promise<string | null> {
    for (const candidatePath of AuthEmailTemplateFileService.getCandidatePaths(relativePath)) {
      try {
        return await fs.readFile(candidatePath, 'utf-8');
      } catch {
        // Next candidate directory.
      }
    }
    return null;
  }

  private static async readOrThrow(relativePath: string): Promise<string> {
    let lastError: unknown = null;

    for (const candidatePath of AuthEmailTemplateFileService.getCandidatePaths(relativePath)) {
      try {
        return await fs.readFile(candidatePath, 'utf-8');
      } catch (error: unknown) {
        lastError = error;
      }
    }

    throw lastError;
  }

  private static getCandidatePaths(relativePath: string): string[] {
    return [
      path.join(__dirname, 'templates', relativePath),
      path.join(__dirname, '../../../../src/controllers/auth/email-templates/templates', relativePath),
      path.join(__dirname, '../../../../dist/controllers/auth/email-templates/templates', relativePath),
    ];
  }
}
