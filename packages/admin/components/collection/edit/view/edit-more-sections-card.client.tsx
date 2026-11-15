import type { ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/react-class-components';
import { FrameworkIcons } from '@fromcode119/react';
import { AdminI18n } from '@/lib/i18n/admin-i18n';
import { CollectionEditRecordMore } from '@/components/collection/edit/view/collection-edit-record-more.client';

/**
 * What else this record holds, at the foot of the record: one row per section the page does not draw,
 * its name and how many fields it adds.
 *
 * It used to be a group inside the ⋯ menu, which is the wrong place for it twice over: a menu is where
 * you look for an ACTION, not for the rest of what you are reading, and a row that only exists while a
 * menu is open is a row nobody finds. Every record page worth copying puts these at the foot — one
 * line, a count, a way in — and so does this.
 *
 * Choosing a row opens that section where it belongs, on this same page, and the address keeps it open.
 */
export class EditMoreSectionsCard extends PureReactor {
  @prop declare sections: Array<{ key: string; title: string; count: number }>;
  @prop declare openedSections: string[];
  @prop declare recordHref: string;
  @prop declare navigate?: (href: string) => void;

  /**
   * The section opens just above this card, where the operator is already looking, so the page does not
   * move under them. Nothing is scrolled: there is nowhere to scroll TO any more.
   */
  private open(key: string): void {
    if (!this.recordHref || !this.navigate) return;
    this.navigate(CollectionEditRecordMore.hrefOpening(this.recordHref, this.openedSections || [], key));
  }

  render(): ReactNode {
    const sections = this.sections || [];
    if (!sections.length || !this.recordHref || !this.navigate) return null;
    return (
      <section className="fc-record-card fc-record-more">
        <header className="fc-record-card__head">
          <h2 className="fc-record-card__title">{AdminI18n.t('collection.edit.more')}</h2>
        </header>
        <div className="fc-record-card__body">
          <div className="fc-record-card__rows">
            {sections.map((section) => (
              <button key={section.key} type="button" className="fc-record-more__row" onClick={() => this.open(section.key)}>
                <span className="fc-record-more__name">{section.title}</span>
                <span className="fc-record-more__count">
                  {AdminI18n.t(section.count === 1 ? 'collection.edit.moreOneField' : 'collection.edit.moreFields', { count: section.count })}
                </span>
                <FrameworkIcons.Right size={15} className="fc-record-more__go" />
              </button>
            ))}
          </div>
        </div>
      </section>
    );
  }
}
