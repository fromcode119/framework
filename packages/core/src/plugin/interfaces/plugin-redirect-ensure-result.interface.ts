/**
 * What `context.redirects.ensure` did with each rule: added, left alone because a rule for that path
 * already exists (the existing one is never changed), or refused with the reason.
 */
export interface IPluginRedirectEnsureResult {
  created: number;
  skipped: number;
  failed: Array<{ fromPath: string; error: string }>;
}
