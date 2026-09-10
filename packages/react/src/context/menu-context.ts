import { Context as ReactorContext } from '@fromcode119/react-class-components';
import type { IMenuItem } from '@react/interfaces/menu-item.interface';

export class MenuContext {
  static readonly Context = new ReactorContext<IMenuItem[]>([]).raw;
}
