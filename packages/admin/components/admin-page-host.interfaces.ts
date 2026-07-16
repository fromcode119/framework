/**
 * Narrow, hook-free view of a page-client that its actions class may drive. The page-client owns the
 * React state and lifecycle; it hands out only this surface so the actions class never touches React.
 *
 * `patch`/`patchWith` are raw `setState` pass-throughs — deliberately UNGUARDED, so callers keep
 * making the `mounted` check explicit exactly where they always did.
 */
export interface AdminPageHost<S> {
  /** True between `componentDidMount` and `componentWillUnmount`. */
  readonly mounted: boolean;
  readonly state: S;
  patch(patch: Partial<S>): void;
  patchWith(updater: (state: S) => Partial<S>): void;
}
