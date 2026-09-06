/**
 * One call from the guest to the host: a path of steps walked from a root.
 *
 * `context.db.find('t', opts)` is `{ root: 'context', steps: [{ name: 'db' }, { name: 'find', args: ['t', opts] }] }`;
 * `context.plugins.namespace('org.x').mlm.record(p)` is four steps, two of them with args. The host
 * walks the steps against the REAL object, awaiting each call, and returns the last value — which
 * therefore has to be data. `token` names the invocation this call belongs to (see
 * PluginInvocationTokens); it is how the host knows which tenant to run the call under.
 */
export interface IPluginRemoteCall {
  root: 'context' | 'core' | 'ddl';
  steps: Array<{ name: string; args?: unknown[] }>;
  token: string | null;
}
