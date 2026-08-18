/**
 * A plugin-supplied lookup for the ONE path a document it owns is served at.
 *
 * Given a document the plugin itself resolved, return that document's canonical storefront path
 * (always root-relative, e.g. `/cosmic-box/lyubov`), or `null` when the plugin declares no canonical
 * path for it. The framework redirects a request that arrives on any OTHER path to this one, so a
 * resolver must return the path the document genuinely lives at — never an SEO `<link rel=canonical>`
 * override, which is a different concept and must not move visitors.
 *
 * A call-signature contract has no class form, so this stays an `interface`.
 */
export interface ICanonicalPathResolver {
  (doc: Record<string, unknown>, type: string): Promise<string | null> | string | null;
}
