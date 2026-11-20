import type { ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/react-class-components';
import { Card } from '@/components/ui/view/card.client';
import { AdminClass } from '@/lib/admin-class';

/**
 * ONE card for everything that stands in a record's columns.
 *
 * A record page used to draw its cards four different ways — the section card (`fc-record-card`), the
 * folded summary, a plugin's panel, and a bare `Card` with `p-4` for the permalink and "About this
 * record". Measured on the product record, 18.11.2026: 22 cards in one page, three different head
 * heights and two different paddings, which is what makes a column of cards read as a pile rather
 * than one page.
 *
 * So the shell lives here: the record card's surface, its head (title, an optional count, room for
 * what the section puts beside it, and its ⋯) and its body. A caller supplies content, never
 * metrics — the head is the same 60px and the body the same padding wherever the card stands.
 */
export class RecordCard extends PureReactor {
  @prop declare children: ReactNode;
  /** The card's name. Without one the card is body only — a head with no title is an empty band. */
  @prop declare title?: string;
  /** How many the card holds, beside the title: `0` is a figure and is shown, `null` is not. */
  @prop declare count?: number | null;
  /** What stands between the title and the ⋯ — a state, a count a plugin adds, a small action. */
  @prop declare aside?: ReactNode;
  /**
   * A band of its OWN under the head: what is on the left narrows the list (filters), what is on the
   * right works on it (search, the column chooser, Create).
   *
   * Its own band, not the head, because that is where the reference puts them — head `px-6 py-4`
   * with the title and the ⋯, then a hairline, then the tools in a band of the same padding. Ours
   * crammed search, filters, sort and Create into the head beside the title, which is why a section
   * holding a table had a head twice as busy as one holding values.
   */
  @prop declare toolbar?: ReactNode;
  /** The card's ⋯ and anything that opens from it. */
  @prop declare menu?: ReactNode;
  @prop declare id?: string;
  /** Added to the card's own class, for a variant the record itself declares (`--editing`). */
  @prop declare className?: string;
  /**
   * The whole head, supplied instead of being built from title/aside/menu. The first card of a record
   * uses it to carry the record's own header — its name, its state and its actions — so that header
   * and the first section's values read as ONE card, the way the reference draws a record. The head is
   * then as tall as its content, not the band's 60px.
   */
  @prop declare headOverride?: ReactNode;

  render(): ReactNode {
    const card = AdminClass.of('record-card');
    const hasHead = Boolean(this.title || this.aside || this.menu);
    return (
      <Card id={this.id} noPadding className={this.className ? `${card} ${this.className}` : card}>
        {this.headOverride ? (
          <div className={`${card}__head ${card}__head--record`}>{this.headOverride}</div>
        ) : hasHead ? (
          <div className={`${card}__head`}>
            <h2 className={`${card}__title`}>
              {this.title}
              {this.count !== null && this.count !== undefined
                ? <span className={`${card}__count`}>{this.count}</span>
                : null}
            </h2>
            {this.aside ? <div className={`${card}__aside`}>{this.aside}</div> : null}
            {this.menu}
          </div>
        ) : null}
        <div className={`${card}__body`}>{this.children}</div>
      </Card>
    );
  }
}
