import type { ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/react-class-components';
import { FrameworkIcons } from '@fromcode119/react';
import { AdminI18n } from '@/lib/i18n/admin-i18n';
import { CollectionListUtils } from '@/components/collection/list/utils';

/**
 * A field the operator may not edit, shown as a VALUE on the recessed surface — not as an input.
 *
 * A disabled input still looks like an input: a white box with a border, sized for typing, sitting in
 * a column of boxes you CAN type into. The only thing separating them was that one ignored the
 * cursor. So a tracking number the courier writes looked exactly like a field nobody had filled in
 * yet, and the emptiest ones read as work outstanding.
 *
 * This is the same treatment `AdminFactGrid` gives recorded values, for the same reason: on this
 * screen, recessed grey means "this was recorded", and white means "you can type here". The label and
 * the unlock control stay in the field header above, so nothing is repeated here.
 */
export class ReadOnlyFieldValue extends PureReactor {
  @prop declare value?: unknown;
  /** Shown when there is no value — never an "Enter…" prompt, which is an instruction you cannot follow. */
  @prop declare emptyLabel?: string;
  /**
   * WHO writes this value, shown in the lock bar rather than as a description line below the field.
   *
   * It is the same sentence either way, but under the field it reads as a footnote about a control,
   * and in the bar it reads as the reason the control is not one. Moving it also removes a row rather
   * than adding one: the field's description line is suppressed when it appears here.
   */
  @prop declare provenance?: string;

  /**
   * The human reading of a stored value, for the field kinds that are not plain text.
   *
   * A locked select must show the option's LABEL, not the code behind it — `cash_on_delivery` is not
   * what the operator calls it — and a locked boolean must read Yes/No rather than `true`. Without
   * this, routing those fields here would have traded a control that looked editable for a value that
   * was unreadable, which is not an improvement.
   */
  static describe(field: any, value: unknown): string {
    const type = String(field?.type || '');

    if (type === 'boolean' || type === 'checkbox') {
      const truthy = value === true || value === 'true' || value === 1 || value === '1';
      return AdminI18n.t(truthy ? 'common.yes' : 'common.no');
    }

    if (type === 'date' || type === 'datetime') {
      const raw = typeof value === 'string' || typeof value === 'number' ? value : '';
      if (!raw) return '';
      const parsed = new Date(raw);
      // An unparseable date is shown verbatim rather than guessed at or blanked.
      if (Number.isNaN(parsed.getTime())) return String(raw);
      return type === 'datetime' ? parsed.toLocaleString() : parsed.toLocaleDateString();
    }

    if (type === 'select') {
      const options = Array.isArray(field?.options) ? field.options : [];
      const match = options.find((option: any) => String(option?.value ?? option) === String(value ?? ''));
      const label = match?.label ?? match?.value ?? match;
      return label === undefined || label === null ? String(value ?? '') : String(label);
    }

    /**
     * A related record is named by its own title, as the list names it. A bare id says nothing a reader can
     * use ("1 · Progress 0" under an enrollment), and an object must never be printed as one: it read
     * "[object Object]" in a record's heading. A related record that was not loaded has no name here, so
     * the line leaves it out — the field itself, below, shows it.
     */
    if (type === 'relationship' || (value !== null && typeof value === 'object')) {
      const entries = Array.isArray(value) ? value : [value];
      return entries
        .filter((entry) => entry !== null && typeof entry === 'object')
        .map((entry) => CollectionListUtils.resolveRelationDisplayLabel(entry))
        .filter(Boolean)
        .join(', ');
    }

    return value === null || value === undefined ? '' : String(value);
  }

  private get text(): string {
    const { value } = this;
    if (value === null || value === undefined) return '';
    if (typeof value === 'string') return value;
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);
    return '';
  }

  render(): ReactNode {
    const text = this.text.trim();
    const provenance = (this.provenance || '').trim();
    // The same box as a locked row (`FieldLockedRow`): field height, recessed fill, the lock where the
    // cursor would be. Who writes the value is a quiet line under it, not a second box above it.
    return (
      <div className="fc-locked-value-stack">
        <div className="fc-locked-value">
          <span className={`fc-locked-value__text${text ? '' : ' fc-locked-value__text--empty'}`}>{text || this.emptyLabel || AdminI18n.t('ui.field.notSet')}</span>
          <FrameworkIcons.Lock size={14} className="fc-locked-value__lock" aria-hidden="true" />
        </div>
        {provenance ? <p className="fc-locked-value__note">{provenance}</p> : null}
      </div>
    );
  }
}
