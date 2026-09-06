/**
 * What a theme render host process is told once, when it starts: which world to build and where the
 * artifacts are. Nothing comes from its environment — it has none.
 */
export interface IThemeRenderBoot {
  /** The `/system/frontend` payload the generation signature is derived from (active theme + plugin versions). */
  config: Record<string, unknown>;
  /** The PUBLIC api base plugin clients bake into image URLs — a visitor's address, not the internal one. */
  publicApiBaseUrl: string;
  themesDir: string;
  pluginsDir: string;
  /** The storefront app's directory: the guest resolves `@fromcode119/react` and its React from here. */
  frontendDir: string;
}
