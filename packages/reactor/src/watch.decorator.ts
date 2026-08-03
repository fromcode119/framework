import { ReactiveMetadata } from './reactive-metadata';

/**
 * `@watch(...keys)` — run the decorated method whenever any of the named state or prop
 * keys changes, receiving `(next, previous)` for the first listed key. The base component
 * dispatches these from `componentDidUpdate`, so subclasses never touch React lifecycle.
 *
 *   export class Player extends OopComponent<Props, State> {
 *     @watch('videoUrl') reload(next: string, prev: string) { this.load(next); }
 *   }
 */
export function watch(...keys: string[]): MethodDecorator {
  return (target: object, propertyKey: string | symbol): void => {
    if (typeof propertyKey !== 'string') {
      throw new TypeError('@watch can only decorate string-named methods.');
    }
    if (keys.length === 0) {
      throw new TypeError(`@watch on "${propertyKey}" needs at least one key to observe.`);
    }
    ReactiveMetadata.addWatcher(target, propertyKey, keys);
  };
}
