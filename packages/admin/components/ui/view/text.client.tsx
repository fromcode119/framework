import { createElement } from 'react';
import type { ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/react-class-components';
import { AdminClass } from '@/lib/admin-class';

/**
 * Running text in one of the console's sizes. A screen reaches for this instead of writing a size and
 * a colour of its own, so the text of every screen changes with the kit.
 */
export class Text extends PureReactor {
  @prop declare children: ReactNode;
  @prop declare size?: 'xsmall' | 'small' | 'base' | 'large';
  /** `plus` is the medium weight, for a value or a name inside running text. */
  @prop declare weight?: 'regular' | 'plus';
  /** The quiet colour, for what is read second. */
  @prop declare muted?: boolean;
  @prop declare as?: 'p' | 'span' | 'div';
  @prop declare className?: string;

  render(): ReactNode {
    const name = AdminClass.of('text');
    const classes = [name, `${name}--${this.size ?? 'small'}`, this.weight === 'plus' ? `${name}--plus` : '', this.muted ? `${name}--muted` : '', this.className ?? ''];
    return createElement(this.as ?? 'p', { className: classes.filter(Boolean).join(' ') }, this.children);
  }
}
