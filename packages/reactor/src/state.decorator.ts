import { ReactiveMetadata } from './reactive-metadata';
import { ReservedMember } from './reserved-member';

/**
 * `@state` — turns a plain class field into reactive React state. Read and assign it like a
 * normal property (`this.count = 5`) and the component re-renders; no `this.setState`, no
 * `this.state.count`. The base component installs the accessor and seeds the initial value
 * from the field initialiser before mount.
 *
 *   export class Counter extends OopComponent {
 *     @state count = 0;
 *     @bound inc() { this.count++; }           // re-renders, no setState
 *   }
 *
 * Requires `useDefineForClassFields: false` (field initialisers assign, not redefine) so the
 * initialiser routes through the accessor rather than clobbering it.
 */
export function state(target: object, propertyKey: string | symbol): void {
  if (typeof propertyKey !== 'string') {
    throw new TypeError('@state can only decorate string-named fields.');
  }
  ReservedMember.assertUsable('@state', target, propertyKey);
  ReactiveMetadata.addStateField(target, propertyKey);
}
