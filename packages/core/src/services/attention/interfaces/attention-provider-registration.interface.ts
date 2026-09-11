/**
 * What a plugin hands the framework so its work can appear on the dashboard's "Needs you" list.
 *
 * `resolve` returns the items that need someone RIGHT NOW — unfulfilled orders, unanswered
 * submissions, a failing integration. It is called on dashboard load, so it must be cheap: one
 * counting query, not a scan. Anything slow or unreliable belongs behind the plugin's own screen.
 */
export interface IAttentionProviderRegistration {
  namespace: string;
  pluginSlug: string;
  key: string;
  label: string;
  resolve: () => Promise<unknown[]> | unknown[];
}
