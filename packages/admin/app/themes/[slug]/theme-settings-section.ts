/**
 * One entry of the Settings tab's second row: a group of the theme's variables, the site's default
 * layout, or the theme's own settings ("extensions"). Its `id` is what `?section=` carries.
 */
export class ThemeSettingsSection {
  static readonly LAYOUT = 'layout';
  static readonly EXTENSIONS = 'extensions';

  private constructor(
    readonly id: string,
    readonly label: string,
    /** The variable group this section edits; null for the layout and extensions sections. */
    readonly variableGroup: string | null,
  ) {}

  static forVariables(group: string, label: string): ThemeSettingsSection {
    return new ThemeSettingsSection(`variables-${group.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`, label, group);
  }

  static layout(label: string): ThemeSettingsSection {
    return new ThemeSettingsSection(ThemeSettingsSection.LAYOUT, label, null);
  }

  static extensions(label: string): ThemeSettingsSection {
    return new ThemeSettingsSection(ThemeSettingsSection.EXTENSIONS, label, null);
  }
}
