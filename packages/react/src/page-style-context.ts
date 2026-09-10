import { Context as ReactorContext } from '@fromcode119/react-class-components';
import type { IPageStyleContextValue } from '@react/interfaces/page-style-context-value.interface';

export class PageStyleContext {
  static readonly context = new ReactorContext<IPageStyleContextValue>({
    styleVariant: 'default',
    styleConfig: null,
  }).raw;
}
