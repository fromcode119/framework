import type { ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/react-class-components';
import { AdminClass } from '@/lib/admin-class';

/**
 * A field's description as one line under its name, on a screen that lays fields out as settings rows.
 *
 * A long one is cut where the line ends (`clamp`) and its ⓘ opens the whole sentence in the same place,
 * so the row always says what the field is without a paragraph pushing the next row down.
 */
export class FieldSummary extends PureReactor {
  declare props: Pick<FieldSummary, 'text' | 'clamp'>;

  @prop declare text: string;
  @prop declare clamp?: boolean;

  render(): ReactNode {
    const summary = AdminClass.of('field-summary');
    return <p className={this.clamp ? `${summary} ${AdminClass.of('field-summary--clamp')}` : summary} title={this.clamp ? this.text : undefined}>{this.text}</p>;
  }
}
