import { ThemeSettingType } from '@fromcode119/core/client';
import { ThemeVariableControl } from '@/lib/theme-variable-control';
import type { ITheme } from '@/app/themes/[slug]/interfaces/theme.interface';

/**
 * One colour the operator actually configured, as the Visual Preview card renders it.
 *
 * This replaces a fixed six-role palette (`primary`/`background`/`foreground`/`muted`/`card`/`accent`)
 * that guessed at variable KEY NAMES. No theme names its variables that way, and no two themes agree —
 * vselenskiportal88 declares `primaryColor`/`secondaryColor`/`accentColor`, snapbilt declares
 * `primary`/`accent`/`obsidian`, and neither declares `muted` or `card` at all — so the lookups missed
 * and the card painted a hardcoded indigo palette nobody had set. Editing the theme's Primary Color
 * changed the field and left the preview untouched.
 *
 * The fix is to stop naming roles. A swatch exists for a variable, carries that variable's own admin
 * label, and shows the value currently in the editor. Nothing is invented: a theme with no colour
 * variables produces an empty list, and the card says so rather than inventing one.
 */
export class ThemePreviewSwatch {
  /** The variable key this swatch reads — the same key the Theme Builder field writes. */
  readonly key: string;
  /** The label the operator sees on that field, so the swatch names its own source. */
  readonly label: string;
  /** The value currently in the editor (unsaved edits included). */
  readonly value: string;

  private constructor(key: string, label: string, value: string) {
    this.key = key;
    this.label = label;
    this.value = value;
  }

  /**
   * Every colour variable of a theme, in declaration order.
   *
   * `variables` is the page's `tempVariables`, which the controller already builds as
   * `{...theme.variables, ...savedConfig.variables}` — the complete declared set with the operator's
   * saved overrides on top. There is no second "defaults" source to fall back to.
   *
   * @param variables - current variable values keyed by variable key
   * @param schema - the theme's `variableSchema`, for labels and declared control types
   * @returns One swatch per colour variable that has a value; empty when the theme declares none
   */
  static listFrom(
    variables: Record<string, string>,
    schema: ITheme['variableSchema'],
  ): ThemePreviewSwatch[] {
    const swatches: ThemePreviewSwatch[] = [];
    for (const [key, rawValue] of Object.entries(variables)) {
      const value = String(rawValue ?? '').trim();
      if (!value) continue;
      const field = schema?.[key];
      if (ThemeVariableControl.resolveType(field?.type, value) !== ThemeSettingType.COLOR) continue;
      swatches.push(new ThemePreviewSwatch(key, field?.label || key, value));
    }
    return swatches;
  }
}
