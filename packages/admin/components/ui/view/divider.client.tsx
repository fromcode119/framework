import type { ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/react-class-components';
import { AdminClass } from '@/lib/admin-class';

/**
 * A line between two things that are not one: across a card, or upright between two groups in a row.
 * Dashed where the two are still parts of one list. The look is `admin.css` (`fc-divider`).
 */
export class Divider extends PureReactor {
  @prop declare orientation?: 'horizontal' | 'vertical';
  @prop declare variant?: 'solid' | 'dashed';
  @prop declare className?: string;

  render(): ReactNode {
    return (
      <div
        role="separator"
        aria-orientation={this.orientation || 'horizontal'}
        className={`${AdminClass.of('divider')} ${this.className ?? ''}`}
        data-orientation={this.orientation || 'horizontal'}
        data-variant={this.variant || 'solid'}
      />
    );
  }
}
