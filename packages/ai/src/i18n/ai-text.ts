import { FrameworkTranslations } from '@fromcode119/react';
import EN from '@ai/i18n/en.json';
import BG from '@ai/i18n/bg.json';

/**
 * The assistant's words, in the language the console speaks.
 *
 * The assistant is its own package mounted inside the admin, so it cannot read the admin's dictionary;
 * it registers its own pack with {@link FrameworkTranslations}, which follows the console's language
 * through `<html lang>`. A new language is one more JSON file here.
 */
export class AiText {
  private static registered = false;

  static t(key: string, vars?: Record<string, unknown>): string {
    if (!AiText.registered) {
      FrameworkTranslations.registerAll({ en: EN as Record<string, unknown>, bg: BG as Record<string, unknown> });
      AiText.registered = true;
    }
    return FrameworkTranslations.t(key, vars);
  }
}
