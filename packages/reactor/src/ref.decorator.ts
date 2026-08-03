import { createRef } from 'react';
import type { RefObject } from 'react';

/**
 * Shorthand for a React ref that starts `null` — lets `@ref` fields read
 * `@ref declare composerRef: Ref<HTMLDivElement>` instead of the noisy
 * `RefObject<HTMLDivElement | null>`.
 */
export type Ref<T> = RefObject<T | null>;

/**
 * `@ref` — declares a React ref field without the `= this.ref<T>()` assignment. The first access
 * lazily creates a `createRef()` and caches it as an own property, so the ref is stable for the
 * instance's lifetime and `ref={this.fileInput}` / `this.fileInput.current` just work.
 *
 *   export class Composer extends Reactor {
 *     @ref declare fileInput: RefObject<HTMLInputElement | null>;   // use `declare` (or `!`)
 *     pick() { this.fileInput.current?.click(); }
 *     render() { return <input ref={this.fileInput} type="file" />; }
 *   }
 *
 * Use `declare` (or `!`) so no field initialiser is emitted to clobber the accessor. Equivalent to
 * `readonly fileInput = this.ref<HTMLInputElement>()` but declarative, matching `@prop`/`@state`.
 */
export function ref(target: object, propertyKey: string | symbol): void {
  if (typeof propertyKey !== 'string') {
    throw new TypeError('@ref can only decorate string-named fields.');
  }
  Object.defineProperty(target, propertyKey, {
    configurable: true,
    get(this: object): unknown {
      const created = createRef();
      // Cache as an own property so every later access returns the SAME ref (shadows this getter).
      Object.defineProperty(this, propertyKey, { value: created, configurable: true, writable: false });
      return created;
    },
  });
}
