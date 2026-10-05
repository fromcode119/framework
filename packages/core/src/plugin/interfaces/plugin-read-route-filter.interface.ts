/** A query parameter a read route narrows by: the collection field it reads and how it compares. */
export interface IPluginReadRouteFilter {
  field: string;
  /** `equals` (default), `contains`, `min`, `max` or `flag` — see ReadRouteMatch. */
  match?: string;
  /**
   * A pattern (Unicode) the value must match for the framework to answer. Any other value is left to the
   * plugin's own route — for a plugin whose rule for unusual values the stored keys cannot mirror.
   */
  accepts?: string;
}
