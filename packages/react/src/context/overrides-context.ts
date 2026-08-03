import { Context as ReactorContext } from '@fromcode119/reactor';
import type { ISlotComponent } from '@react/interfaces/slot-component.interface';

export class OverridesContext {
  static readonly Context = new ReactorContext<Record<string, ISlotComponent>>({}).raw;
}
