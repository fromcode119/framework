/**
 * Compiles a theme's source folder into the `ui/` folder the platform serves.
 *
 * An interface because core cannot import the builder (the builder depends on core): the API, which can,
 * hands an implementation to the `ThemeManager` at boot. Rejects with the failed step's own message.
 */
export interface IThemeBuilder {
  build(sourceDir: string, slug: string): Promise<void>;
}
