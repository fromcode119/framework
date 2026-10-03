/**
 * Where a plugin's `context.fetch` may go, as its manifest declares it under `network`.
 *
 * Either a list of hosts (`"api.payments.example"`, or `"*.courier.example"` for every subdomain), or `any: true`
 * with the `reason` an operator reads before approving it — for a plugin that calls an address the
 * operator types in, such as a webhook URL.
 */
export interface IPluginNetworkDeclaration {
  hosts?: string[];
  any?: boolean;
  reason?: string;
}
