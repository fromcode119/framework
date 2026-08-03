/**
 * A resolved CMS/plugin document on its way out of the server.
 *
 * A "gate" is a plugin-supplied transformer applied to this result before it leaves the server. The
 * framework holds NO knowledge of what any gate does (subscriptions, paywalls, geo-fencing, …) — it
 * only runs the registered transformers in sequence and returns the final result.
 *
 * Absence is expressed by the CALLER as `ContentResolutionResult | null`, not by folding `null` into
 * the shape — a nullable alias hides which side of a signature may be empty.
 */
export class ContentResolutionResult {
  /** Document kind, as named by the plugin that resolved it. */
  declare type: string;

  /** Slug of the plugin that owns the document. */
  declare plugin: string;

  /** The document itself — opaque to the framework, shaped by the owning plugin. */
  declare doc: unknown;
}
