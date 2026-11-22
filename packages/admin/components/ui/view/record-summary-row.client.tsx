import type { ReactNode } from 'react';
import { Reactor, prop, state, bound } from '@fromcode119/react-class-components';
import { FrameworkIcons } from '@fromcode119/react';
import { ButtonVariant } from '@/components/ui/enums/button-variant.enum';
import { Button } from '@/components/ui/view/button.client';
import { EditSheet } from '@/components/ui/view/edit-sheet.client';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

/**
 * A record that holds more than a person reads at once, told as ONE quiet row — its name, how many
 * values it holds, one line about it — that opens the values in a drawer beside the page.
 *
 * It exists so that nothing a card is given can run the page to thousands of pixels. A stored object, a
 * block of metadata, a payload: whatever its size, the card shows this row, and everything the object
 * holds is one press away, searchable, with the page still readable behind it. The row is the whole
 * button, not a small icon at its end, so the target is as wide as the row.
 *
 * The drawer is {@link EditSheet} — the same panel every other edit and detail in the console opens — so
 * it follows the console's drawer in width, in motion, and on a phone. Its foot carries Close.
 */
export class RecordSummaryRow extends Reactor {
  /** What the record is called: the drawer's title, and the row's own text unless `rowText` is given. */
  @prop declare title: string;
  /**
   * What the row says in place of `title`, for a card whose own heading already names the record
   * (`166 values` under "Order record"): the name is then said once, by the heading, and not twice.
   * Given this, the count pill is not drawn — the row already is the count.
   */
  @prop declare rowText?: string;
  /** How many values it holds. Left out for a record whose size is not the point. */
  @prop declare count?: number;
  /** The count in words (`166 values`); the caller supplies it so the row speaks the console's language. */
  @prop declare countLabel?: string;
  /** One short line about what is inside, at the row's end (`Payment, VAT, handover`). Never a value. */
  @prop declare hint?: ReactNode;
  /** One quiet line under the drawer's title. */
  @prop declare subtitle?: ReactNode;
  /** The values, drawn inside the drawer. */
  @prop declare children: ReactNode;
  @prop declare className?: string;
  @prop declare openLabel?: string;

  @state private isOpen = false;

  @bound private open(): void {
    this.isOpen = true;
  }

  @bound private close(): void {
    this.isOpen = false;
  }

  private renderFoot(): ReactNode {
    return (
      <Button type="button" variant={ButtonVariant.OUTLINE} onClick={this.close}>
        {AdminI18n.t('common.close')}
      </Button>
    );
  }

  render(): ReactNode {
    return (
      <div className={`fc-rsr${this.className ? ` ${this.className}` : ''}`}>
        <button type="button" className="fc-rsr__row" onClick={this.open} aria-haspopup="dialog" aria-label={this.openLabel ?? this.title}>
          <span className="fc-rsr__title">{this.rowText ?? this.title}</span>
          {this.countLabel && this.rowText === undefined ? <span className="fc-rsr__count">{this.countLabel}</span> : null}
          {this.hint ? <span className="fc-rsr__hint">{this.hint}</span> : null}
          <FrameworkIcons.ChevronRight size={16} className="fc-rsr__go" />
        </button>
        <EditSheet isOpen={this.isOpen} title={this.title} subtitle={this.subtitle ?? this.countLabel} onClose={this.close} foot={this.renderFoot()}>
          {this.children}
        </EditSheet>
      </div>
    );
  }
}
