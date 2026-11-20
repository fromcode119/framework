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
   * Choosing a row opens that section's held-back fields where the section is drawn: inside its card
   * when the record already shows one (often a screen above), or just above this card when it does not.
   * Either way it appeared somewhere other than where the operator pressed, and they had to go and find
   * it. Once it is drawn the page moves so the section's head lands where the pressed row was.
   */
  /** The row just pressed and where it was, until the page has drawn what it opened. */
  private pending: { key: string; pressedAt: number } | null = null;

  private open(key: string, row: HTMLElement): void {
    if (!this.recordHref || !this.navigate) return;
    this.pending = { key, pressedAt: row.getBoundingClientRect().top };
    this.navigate(CollectionEditRecordMore.hrefOpening(this.recordHref, this.openedSections || [], key));
  }

  /** The address now names the section, so the page has drawn it: move the page by what it moved. */
  componentDidUpdate(): void {
    const pending = this.pending;
    if (!pending || !(this.openedSections || []).includes(pending.key) || typeof window === 'undefined') return;
    this.pending = null;
    window.requestAnimationFrame(() => {
      // At the foot a section is drawn under its own key (`section-side:…` for a side one); in its card
      // in the side column, under the key that card answers to.
      const section = [`section-${pending.key}`, CollectionEditRecordMore.anchorId(pending.key)]
        .map((id) => document.getElementById(id)).find(Boolean);
      if (!section) return;
      const shift = section.getBoundingClientRect().top - pending.pressedAt;
      if (Math.abs(shift) < 1) return;
      let scroller: HTMLElement | null = section.parentElement;
      while (scroller && !(scroller.scrollHeight > scroller.clientHeight && /(auto|scroll)/.test(getComputedStyle(scroller).overflowY))) {
        scroller = scroller.parentElement;
      }
      (scroller || document.scrollingElement || document.documentElement).scrollBy({ top: shift });
    });
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
              <button key={section.key} type="button" className="fc-record-more__row" onClick={(event) => this.open(section.key, event.currentTarget)}>
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
