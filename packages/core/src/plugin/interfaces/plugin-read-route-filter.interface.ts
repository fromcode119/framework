/** A query parameter a read route narrows by: the collection field it reads and how it compares. */
export interface IPluginReadRouteFilter {
  field: string;
  /** `equals` (default), `in`, `contains`, `min`, `max` or `flag` — see ReadRouteMatch. */
  match?: string;
  /**
   * A pattern (Unicode) the value must match for the framework to answer. Any other value is left to the
   * plugin's own route — for a plugin whose rule for unusual values the stored keys cannot mirror.
   */
  accepts?: string;
  /**
   * The field is the record's own column (its slug, its id), known whether or not the record's document is
   * prepared. The filter then narrows the records that are not prepared too, so a lookup of two named records
   * is not answered by the plugin for the sake of some other record that has no document yet.
   */
  exact?: boolean;
}
