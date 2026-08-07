/**
 * Declares, on a collection field, WHERE the field's value comes from when the record leaves it empty.
 *
 * The admin renders this as provenance under the field, so an empty box can no longer hide the fact
 * that a plugin setting is deciding what the storefront shows.
 *
 * A rule names the setting by KEY only. The human label and the tab it lives on are read from the
 * plugin's own settings schema at render time — the first version repeated them here, which meant
 * renaming a setting silently left the provenance line quoting a label that no longer existed.
 */
export interface IFieldFallbackRule {
  /** Key in the owning plugin's settings that supplies the value when this field is empty. */
  settingKey: string;
  /** Only inherit when this sibling field holds this value — lets one field inherit from different settings. */
  when?: { field: string; equals: unknown };
  /** What actually happens when nothing is inherited, e.g. "no delivery window is shown." */
  emptyMeans?: string;
}
