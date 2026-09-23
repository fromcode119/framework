/**
 * The thing records are being asked ABOUT, when that thing is not a person.
 *
 * Every field is OPAQUE to the framework. `kind` is a string the declaring plugin owns
 * (`org.fromcode:catalog:order`); `keys` are correlation keys the subject can offer about itself
 * (`orderNumber`, `email`, …). The framework never interprets either — it only hands the subject to
 * the providers that declared they understand one of its keys.
 *
 * Correlation KEYS, not subject kinds, are what a provider matches on. That is deliberate: a provider
 * matching `kind === 'org.fromcode:catalog:order'` would be one plugin hardcoding another plugin's
 * name, which this codebase does not allow. Matching `orderNumber` names a shared vocabulary term
 * instead — the same way `email` is shared — so a provider contributes to ANY subject that can
 * identify itself that way, including ones written after the provider.
 */
export interface IEntityRecordSubject {
  /** Opaque kind, owned by the declaring plugin. Carried through for display/telemetry only. */
  kind: string;
  /** The subject's own id, opaque. */
  id: string;
  /** Correlation keys the subject offers about itself. Values are compared by providers, never here. */
  keys: Record<string, string>;
}
