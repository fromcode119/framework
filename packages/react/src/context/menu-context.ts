import { Context as ReactorContext } from '@fromcode119/reactor';
import type { IMenuItem } from '@react/interfaces/menu-item.interface';

export class MenuContext {
  static readonly Context = new ReactorContext<IMenuItem[]>([]).raw;
}
