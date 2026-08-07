/**
 * The translate function a plugin or theme UI is handed — the shape of `context.i18n.t` and of the
 * `this.t` getter on `PluginComponent`.
 *
 * An `interface` with a CALL SIGNATURE rather than a `type` alias: a function type has no class form,
 * but it IS a genuine behavioural contract, which is exactly what `interface` survives for.
 *
 * Framework-owned on purpose. Four byte-identical copies of this contract had grown up in cms, mlm,
 * ecommerce and forms (plus loose `type T = (key, vars?, fallback?) => string` aliases inside prop
 * interface files) — the same helper in more than one plugin is framework work, not plugin work.
 * Import it as a TYPE, so it erases at build time and costs nothing at runtime.
 */
export interface ITranslateFn {
  (key: string, vars?: Record<string, unknown>, fallback?: string): string;
}
