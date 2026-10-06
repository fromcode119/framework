/**
 * A named segment of a read route's path (`:slug` in `/products/:slug`): the record the route answers is
 * the one whose `field` equals the segment.
 */
export interface IPluginReadRouteParam {
  /** The collection field the segment must equal. */
  field: string;
  /** A pattern the segment must match; a segment that does not goes to the plugin. */
  accepts?: string;
}
