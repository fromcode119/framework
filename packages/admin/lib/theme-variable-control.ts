import { ThemeSettingType } from '@fromcode119/core/client';

/**
 * Decides which admin control a theme variable gets.
 *
 * The rule lives HERE and nowhere else so that everything showing a variable agrees by construction:
 * the variables panel renders a `ColorPicker` for exactly the keys the Visual Preview shows a swatch
 * for. Duplicating the inference is how the two drift apart, and a preview swatch that has no matching
 * editable control is precisely the magic this file exists to prevent.
 *
 * A theme MAY declare `variableSchema[key].type`; when it does, that declaration wins outright. When it
 * does not (minimal-blue declares no schema at all), the value's own shape decides — a `#`-prefixed
 * value is a colour. That inference is the theme author's data speaking, not an invented default.
 */
export class ThemeVariableControl {
  /**
   * @param declaredType - `variableSchema[key].type`, already hydrated to an enum member, or undefined
   * @param value - the variable's current value
   * @returns The control type to render
   * @example
   * ThemeVariableControl.resolveType(undefined, '#8B5CF6'); // ThemeSettingType.COLOR
   * ThemeVariableControl.resolveType(undefined, 'main-menu'); // ThemeSettingType.TEXT
   */
  static resolveType(declaredType: ThemeSettingType | undefined, value: string | undefined): ThemeSettingType {
    if (declaredType) return declaredType;
    return String(value ?? '').startsWith('#') ? ThemeSettingType.COLOR : ThemeSettingType.TEXT;
  }
}
