import { Context as ReactorContext } from '@fromcode119/react-class-components';
import type { ISlotComponent } from '@react/interfaces/slot-component.interface';

export class OverridesContext {
  static readonly Context = new ReactorContext<Record<string, ISlotComponent>>({}).raw;
}
