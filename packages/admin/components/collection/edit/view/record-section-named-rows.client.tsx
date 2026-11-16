import type { ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/react-class-components';
import { AdminClass } from '@/lib/admin-class';
import { RecordSectionFields } from '@/components/collection/edit/record-section-fields';
import { FieldDisplayLabel } from '@/lib/collection/field-display-label';

/**
 * A section none of whose fields is filled in: its rows, each with a dash.
 *
 * It used to be one sentence — "nothing filled in yet" — which is the one thing the reader already knew.
 * Which fields the section offers, and therefore what Edit would ask for, was not said anywhere. Counted
 * on one product: five of sixteen cards were that sentence, so a quarter of the record page carried no
 * information at all, in a shape no other card on the page had. The dash row is the card's own row, so
 * an empty section now reads as the same kind of thing as a full one.
 *
 * A section with no rows to name (one a plugin's slot fills, one whose only field draws its own control)
 * draws nothing: a card is allowed to be short.
 */
export class RecordSectionNamedRows extends PureReactor {
  @prop declare fields: any[];

  /** What a row with nothing in it says. */
  private static readonly NO_VALUE = '–';

  render(): ReactNode {
    const card = AdminClass.of('record-card');
    const named = RecordSectionFields.blankFields(this.fields);
    if (!named.length) return null;
    return (
      <dl className={`${card}__rows`}>
        {named.map((field: any) => (
          <div key={field.name} className={`${card}__row`}>
            <dt className={`${card}__label`}>{FieldDisplayLabel.of(field)}</dt>
            <dd className={`${card}__value ${card}__value--none`}>{RecordSectionNamedRows.NO_VALUE}</dd>
          </div>
        ))}
      </dl>
    );
  }
}
