/**
 * One site's database scope, reused across a run of short calls that belong together — every
 * statement an isolated plugin sends back while serving ONE invocation.
 *
 * Each `run` is a complete tenant scope, bound to the lease's site exactly as `withTenant` binds one.
 * What the lease adds is that the bound connection may be kept between runs instead of being cleared,
 * handed back and bound again for the next statement a moment later. `close` gives it back for good.
 */
export interface ITenantScopeLease {
  run<T>(fn: () => Promise<T>): Promise<T>;
  close(): Promise<void>;
}
