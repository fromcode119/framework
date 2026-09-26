import { WatcherDescriptor } from '@fromcode119/react-class-components/lang';

/**
 * Dispatching `@watch` callbacks for one component instance.
 *
 * It keeps its OWN last-seen values rather than trusting React's `prevState`: the `@state` setter
 * mutates `this.state` in place, so React hands back an already-mutated `prevState` and every state
 * watcher would compare a value against itself. Props are never mutated, so React's `prevProps` IS
 * authoritative for `@prop` keys — which is also what the manual-didUpdate unit tests rely on.
 */
export class ReactiveWatchers {
  private readonly previous: Record<string, unknown> = {};

  constructor(
    private readonly watchers: readonly WatcherDescriptor[],
    private readonly stateKeys: ReadonlySet<string>,
  ) {}

  /** Seed the snapshot at mount, so the FIRST post-mount state change compares to a real baseline. */
  seed(state: Record<string, unknown> | undefined): void {
    for (const watcher of this.watchers) {
      for (const key of watcher.keys) if (state && key in state) this.previous[key] = state[key];
    }
  }

  /** The (prev, curr) pair for one watched key. */
  private pair(
    key: string,
    state: Record<string, unknown> | undefined,
    props: Record<string, unknown> | undefined,
    prevProps: Record<string, unknown> | undefined,
  ): { prev: unknown; curr: unknown } {
    if (this.stateKeys.has(key)) return { prev: this.previous[key], curr: state?.[key] };
    return { prev: prevProps?.[key], curr: props?.[key] };
  }

  /** Fire every watcher whose keys changed, then re-snapshot the watched state. */
  dispatch(
    host: object,
    state: Record<string, unknown> | undefined,
    props: Record<string, unknown> | undefined,
    prevProps: Record<string, unknown> | undefined,
  ): void {
    const instance = host as unknown as Record<string, (next: unknown, previous: unknown) => void>;
    for (const watcher of this.watchers) {
      for (const key of watcher.keys) {
        const { prev, curr } = this.pair(key, state, props, prevProps);
        if (prev !== curr) {
          instance[watcher.method](curr, prev);
          break; // one fire per watcher, matching the first changed key
        }
      }
    }
    // Refresh the state snapshot AFTER dispatch, so re-entrant state changes compare against this baseline.
    for (const watcher of this.watchers) {
      for (const key of watcher.keys) if (this.stateKeys.has(key) && state) this.previous[key] = state[key];
    }
  }
}
