/**
 * Identifies WHERE a rejected route handler came from, so the global error handler can name the
 * offending plugin and route in the server log instead of printing a bare stack.
 *
 * Attached to the error object by {@link AsyncRouteGuard} at the moment the rejection is forwarded to
 * Express, because that is the only point at which the plugin slug and the request are both in scope.
 */
export interface IRouteFailureOrigin {
  /** Plugin slug when the handler belongs to a plugin, otherwise the framework router class name. */
  source: string;
  /** HTTP method of the request that rejected. */
  method: string;
  /** Path of the request that rejected. */
  path: string;
}
