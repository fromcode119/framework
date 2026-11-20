import type { ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/react-class-components';
import { RecordCard } from '@/components/ui/view/record-card.client';
import { AdminClass } from '@/lib/admin-class';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

/**
 * What the system knows about the record itself: its id and when it was made and last changed.
 *
 * Three facts, drawn as the record's own rows — label, value, a rule between them — because that is
 * what every other card on the page does. It used to be a card of its own kind: `p-4` instead of the
 * record's padding, 12px slate text, an id in a grey pill, and a head 12px shallower than the card
 * above it.
 */
export class RecordInfo extends PureReactor {
  @prop declare id: string;
  @prop declare createdAt?: string | Date;
  @prop declare updatedAt?: string | Date;

  private row(label: string, value: ReactNode): ReactNode {
    const card = AdminClass.of('record-card');
    return (
      <div className={`${card}__row`}>
        <dt className={`${card}__label`}>{label}</dt>
        <dd className={`${card}__value`}>{value}</dd>
      </div>
    );
  }

  render(): ReactNode {
    const { id, createdAt, updatedAt } = this;
    const card = AdminClass.of('record-card');
    return (
      <RecordCard title={AdminI18n.t('collection.info.title')}>
        <dl className={`${card}__rows`}>
          {this.row(AdminI18n.t('collection.info.id'), id)}
          {createdAt ? this.row(AdminI18n.t('collection.info.created'), new Date(createdAt).toLocaleString()) : null}
          {updatedAt ? this.row(AdminI18n.t('collection.info.updated'), new Date(updatedAt).toLocaleString()) : null}
        </dl>
      </RecordCard>
    );
  }
}
