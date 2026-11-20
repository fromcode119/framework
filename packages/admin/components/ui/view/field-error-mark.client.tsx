import type { ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/react-class-components';
import { FrameworkIcons } from '@fromcode119/react';
import { Tooltip } from '@/components/ui/view/tooltip.client';
import { AdminClass } from '@/lib/admin-class';

/**
 * What is wrong with a field, as a mark INSIDE the field: the words show on hover, on focus and on a
 * tap. A line of text under the field moved everything below it down the moment the field went wrong,
 * and in a row of fields it left one cell taller than its neighbours.
 *
 * The words are also in the page for a screen reader, which has no hover.
 */
export class FieldErrorMark extends PureReactor {
  @prop declare message: string;

  render(): ReactNode {
    const name = AdminClass.of('field-mark');
    return (
      <span className={name}>
        <Tooltip content={this.message} side="bottom">
          <button type="button" className={`${name}__button`} aria-label={this.message}>
            <FrameworkIcons.Alert size={15} />
          </button>
        </Tooltip>
      </span>
    );
  }
}
