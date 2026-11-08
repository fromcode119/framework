/**
 * The ONE spelling of a theme.json variable as a CSS custom property.
 *
 * A key already written as a custom property (`--tps-color-pink`) is used as written; a plain key
 * (`primaryColor`) becomes `--theme-primary-color`. The server stylesheet, the storefront initializer and
 * the React theme manager each had their own rule, so the same variable reached the page under three
 * names (`--theme-primary-color`, `--theme-primaryColor`, `--theme---tps-color-pink`) and anything that
 * read one of them — the account shell reads `--theme-primary-color` — silently saw nothing.
 */
export class ThemeCssVariable {
  static propertyFor(key: string): string {
    return key.startsWith('--') ? key : `--theme-${key.replace(/([A-Z])/g, '-$1').toLowerCase()}`;
  }
}
