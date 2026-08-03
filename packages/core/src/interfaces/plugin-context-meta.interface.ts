/**
 * The `context.meta` surface of {@link PluginContext}.
 *
 * Extracted from an anonymous inline object type: a plugin-facing CONTRACT deserves a name it can be
 * referenced by, and 25 of these inline in one class put the file at 366 lines.
 */
export interface IPluginContextMeta {
  get(key: string): Promise<string | null>;
  /** Upsert a meta value through the framework (plugins must not write SystemTable.META directly). */
  set(key: string, value: unknown): Promise<void>;
  /** Atomically advance a gap-free numeric counter (optimistic-locked) and return the new value. */
  advanceCounter(key: string, startFloor?: number, maxAttempts?: number): Promise<number>;
}
