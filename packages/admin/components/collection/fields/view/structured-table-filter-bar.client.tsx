import type { ReactNode } from 'react';
import { PureReactor, prop, bound } from '@fromcode119/react-class-components';
import { FrameworkIcons } from '@fromcode119/react';
import { StructuredReadOnlyFieldService } from '@/components/collection/fields/structured-read-only-field-service';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

/**
 * The line under a table's toolbar that says what the table is currently narrowed to.
 *
 * It is drawn whether or not anything is picked. A bar that appears only once a filter is on moves
 * the table down by its own height the moment someone filters, so the rows jump under the pointer
 * that was about to click one; holding the line empty costs the card a fixed strip and costs the
 * reader nothing. Each picked value is a chip that names the column it narrows and carries the way
 * to drop it, so a narrowed table never looks like a short one.
 */
export class StructuredTableFilterBar extends PureReactor {
  /** The value picked per column; an entry with an empty value is not a filter. */
  @prop declare picked: Record<string, string>;
  @prop declare keyLabels?: Record<string, string>;
  @prop declare onClear: (column: string) => void;
  @prop declare onClearAll: () => void;

  private get active(): Array<[string, string]> {
    return Object.entries(this.picked ?? {}).filter(([, value]) => value);
  }

  @bound private clearAll(): void {
    this.onClearAll();
  }

  render(): ReactNode {
    const active = this.active;
    return (
      <div className="fc-sro-table__filters">
        {active.map(([column, value]) => (
          <span key={column} className="fc-sro-filter">
            <span className="fc-sro-filter__name">
              {StructuredReadOnlyFieldService.keyLabel(column, this.keyLabels)}
            </span>
            <span className="fc-sro-filter__value">{value}</span>
            <button
              type="button"
              className="fc-sro-filter__drop"
              aria-label={AdminI18n.t('ui.structured.filterClear')}
              title={AdminI18n.t('ui.structured.filterClear')}
              onClick={() => this.onClear(column)}
            >
              <FrameworkIcons.Close size={14} />
            </button>
          </span>
        ))}
        {active.length > 1 ? (
          <button type="button" className="fc-sro-filter__clear-all" onClick={this.clearAll}>
            {AdminI18n.t('ui.structured.filterClearAll')}
          </button>
        ) : null}
      </div>
    );
  }
}
