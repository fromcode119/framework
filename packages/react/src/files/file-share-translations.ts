import { ContextBridge } from '@react/context-bridge';
import { FrameworkTranslations } from '@react/i18n/framework-translations';
import EN from '@react/files/i18n/en.json';
import BG from '@react/files/i18n/bg.json';

/**
 * The share page's words, registered twice on purpose.
 *
 * Into {@link FrameworkTranslations} so the page speaks the right language with no theme, no plugin and
 * no context provider — a share link lands on a stranger's browser and has to work on any install. And
 * into the context bridge as well, so a theme or plugin can still override the copy the normal way when
 * the provider IS present.
 */
export class FileShareTranslations {
  private static bridged = false;

  static register(): void {
    // Framework-level: synchronous, no bridge, cannot fail.
    FrameworkTranslations.registerAll({ en: EN as any, bg: BG as any });

    if (FileShareTranslations.bridged) return;
    try {
      ContextBridge.registerTranslations({ en: EN, bg: BG });
      FileShareTranslations.bridged = true;
    } catch {
      // Bridge not ready — the framework copy above already covers the page, so this is not a failure.
    }
  }
}
