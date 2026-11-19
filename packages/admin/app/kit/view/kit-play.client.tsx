import type { ReactNode } from 'react';
import { Reactor, prop, state, bound } from '@fromcode119/react-class-components';

/**
 * Holds one value for an example, so a field in the kit can be typed in and a switch can be flipped
 * without every example keeping state of its own. `children` is given the value and the way to set it.
 */
export class KitPlay extends Reactor {
  declare props: { initial: any; children: (value: any, set: (value: any) => void) => ReactNode };
  @prop declare initial: any;
  @prop declare children: (value: any, set: (value: any) => void) => ReactNode;
  @state private value: any = undefined;
  @state private touched = false;

  @bound private set(value: any): void {
    this.value = value;
    this.touched = true;
  }

  render(): ReactNode {
    return this.children(this.touched ? this.value : this.initial, this.set);
  }
}
