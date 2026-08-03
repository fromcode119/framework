/**
 * `@bound` — auto-binds a method to its instance, so you can pass `this.onSave` as a
 * callback without `.bind(this)` and without arrow-function class properties. Kills the
 * duplicated-`this` boilerplate that hook-free React class components otherwise force.
 *
 *   export class Editor extends OopComponent {
 *     @bound onSave() { this.api.save(this.state.doc); }   // pass straight to onClick=
 *   }
 *
 * Implemented as a legacy accessor decorator: the first access per instance binds the
 * prototype method and caches it as an own property.
 */
export function bound(
  _target: object,
  propertyKey: string,
  descriptor: PropertyDescriptor,
): PropertyDescriptor {
  const original = descriptor.value;
  if (typeof original !== 'function') {
    throw new TypeError(`@bound can only decorate methods, not "${propertyKey}".`);
  }
  return {
    configurable: true,
    get(this: Record<string, unknown>) {
      const boundFn = original.bind(this);
      Object.defineProperty(this, propertyKey, {
        value: boundFn,
        configurable: true,
        writable: true,
      });
      return boundFn;
    },
  };
}
