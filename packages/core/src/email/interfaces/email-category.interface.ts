/**
 * One opt-outable email stream, as declared by the plugin that sends it.
 *
 * The label and description are i18n KEYS, not text: the sender owns its own copy, and the preferences
 * screen renders whatever the viewer's locale resolves them to. Storing rendered strings here would
 * freeze one language into a framework registry.
 */
export interface IEmailCategory {
  /** The value that appears on the mail and in the suppression list, e.g. `review-invitation`. */
  key: string;
  labelKey: string;
  descriptionKey: string;
  /** Which plugin declared it — for provenance in the admin, never for behaviour. */
  pluginSlug: string;
}
