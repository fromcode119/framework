import { ThemeConfigFieldType, ThemeSettingType, ThemeState } from '@fromcode119/core/client';
import type { ITheme } from '@/app/themes/[slug]/interfaces/theme.interface';

/**
 * Turns a raw themes-API row into an {@link ITheme}.
 *
 * Every enum-typed member of `ITheme` arrives as a PLAIN STRING (an `Enum` serialises to its `value`
 * via `toJSON`), so they are hydrated HERE — once, at the fetch boundary. Skip it and every downstream
 * `===` compares an object to a string and is permanently false: `theme.state === ThemeState.ACTIVE`
 * already shipped that way, showing the active theme as inactive and labelling its destroy button
 * "Destroy Theme" instead of "Switch & Destroy Theme".
 *
 * The cast off the wire happens here and nowhere else: `AdminApi.get` returns `any`, and this is the
 * single place that turns that into a typed record.
 */
export class ThemeRecordHydrator {
  static hydrate(row: Record<string, unknown>): ITheme {
    const theme = row as unknown as ITheme;
    return {
      ...theme,
      state: ThemeState.resolve(row.state),
      variableSchema: ThemeRecordHydrator.hydrateVariableSchema(theme.variableSchema),
      settingsSchema: ThemeRecordHydrator.hydrateSettingsSchema(theme.settingsSchema),
    };
  }

  /** Hydrate each variable field's control `type`; leave it unset when the theme declared none. */
  private static hydrateVariableSchema(schema: ITheme['variableSchema']): ITheme['variableSchema'] {
    if (!schema) return undefined;
    const hydrated: NonNullable<ITheme['variableSchema']> = {};
    for (const [key, field] of Object.entries(schema)) {
      hydrated[key] = { ...field, type: field?.type ? ThemeSettingType.resolve(field.type) : undefined };
    }
    return hydrated;
  }

  /** Hydrate each settings field's control `type`; leave it unset when the theme declared none. */
  private static hydrateSettingsSchema(schema: ITheme['settingsSchema']): ITheme['settingsSchema'] {
    if (!schema) return undefined;
    const hydrated: NonNullable<ITheme['settingsSchema']> = {};
    for (const [key, field] of Object.entries(schema)) {
      hydrated[key] = { ...field, type: field?.type ? ThemeConfigFieldType.resolve(field.type) : undefined };
    }
    return hydrated;
  }
}
