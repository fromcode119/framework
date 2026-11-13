import type { ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/react-class-components';
import { FrameworkIcons } from '@fromcode119/react';
import { AdminLink } from '@/components/view/admin-link.client';
import { Card } from '@/components/ui/view/card.client';
import { AdminClass } from '@/lib/admin-class';
import { AdminI18n } from '@/lib/i18n/admin-i18n';
import { CollectionEditRecordMore } from '@/components/collection/edit/view/collection-edit-record-more.client';

/**
 * "More": one row per section holding fields the record does not draw (rarely used or technical ones),
 * each naming how many and opening that section on its own page. Nothing folds open in place, and
 * nothing is out of reach. Renders nothing when every field is already on the record.
 */
export class EditRecordMoreCard extends PureReactor {
  @prop declare sections: Array<{ key: string; title: string; count: number }>;
  /** The record's own address; a row adds `?section=<key>` to it. */
  @prop declare recordHref: string;

  render(): ReactNode {
    if (!this.sections?.length) return null;
    const more = AdminClass.of('record-more');
    return (
      <Card noPadding className={more}>
        <h2 className={`${more}__title`}>{AdminI18n.t('collection.edit.more')}</h2>
        <ul className={`${more}__rows`}>
          {this.sections.map((section) => (
            <li key={section.key}>
              <AdminLink
                href={`${this.recordHref}?${CollectionEditRecordMore.PARAM}=${encodeURIComponent(section.key)}`}
                className={`${more}__row`}
              >
                <span className={`${more}__name`}>{section.title}</span>
                <span className={`${more}__count`}>
                  {AdminI18n.t(section.count === 1 ? 'collection.edit.moreOneField' : 'collection.edit.moreFields', { count: section.count })}
                </span>
                <FrameworkIcons.Right size={14} />
              </AdminLink>
            </li>
          ))}
        </ul>
      </Card>
    );
  }
}
