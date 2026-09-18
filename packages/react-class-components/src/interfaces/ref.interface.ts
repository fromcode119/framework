import type { RefObject } from 'react';

/**
 * Shorthand for a React ref that starts `null` — lets `@ref` fields read
 * `@ref declare composerRef: Ref<HTMLDivElement>` instead of the noisy
 * `RefObject<HTMLDivElement | null>`.
 *
 * An INTERFACE, not a `type` alias, and the distinction is the convention rather than taste: a ref is
 * an object with a `current`, so extending the React one says exactly that and leaves no second way
 * to spell the same shape. It was an alias, which is the form this codebase keeps only for what no
 * interface can express — a union, or a function signature. This is neither.
 */
export interface Ref<T> extends RefObject<T | null> {}
