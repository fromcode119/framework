import type { ReactNode } from 'react';
import { PureReactor, prop, bound } from '@fromcode119/react-class-components';
import { FrameworkIcons } from '@fromcode119/react';
import { ListFilter } from '@/components/ui/list-toolbar/list-filter';
import { Button } from '@/components/ui/view/button.client';
import { ButtonVariant } from '@/components/ui/enums/button-variant.enum';
import { FieldSize } from '@/components/ui/enums/field-size.enum';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

/**
 * Every filter of the list in one place, the panel of the Filters button's Dropdown. A filter applies
 * the moment a value is picked; the button at the bottom only closes the panel.
 */
export class FilterPanel extends PureReactor {
  declare props: Pick<FilterPanel, 'filters' | 'total' | 'onClose'>;

  @prop declare filters: readonly ListFilter[];
  /** Records the current filters match, for the button that closes the panel. */
  @prop declare total: number;
  @prop declare onClose: () => void;

  componentDidMount(): void {
    this.listen(document, 'keydown', this.handleKey);
  }

  @bound private handleKey(event: Event): void {
    if ((event as KeyboardEvent).key === 'Escape') this.onClose();
  }

  @bound private clearAll(): void {
    for (const filter of this.filters) if (filter.isActive) filter.reset();
  }

  private renderFilter(filter: ListFilter): ReactNode {
    return (
      <div key={filter.key} className="fc-filter-panel__group">
        <div className="fc-menu-section">{filter.label}</div>
        <div className="fc-filter-panel__options">
          {filter.options.map((option) => {
            const chosen = option.value === filter.value;
            return (
              /* One of several choices, only one of which is on: the console's tab. */
              <button key={option.value} type="button" aria-pressed={chosen} onClick={() => filter.apply(option.value)} className={`fc-tab${chosen ? ' fc-tab--on' : ''}`}>
                {option.label}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  render(): ReactNode {
    const anyActive = this.filters.some((filter) => filter.isActive);
    return (
      <div role="dialog" aria-label={AdminI18n.t('ui.listToolbar.filters')} className="fc-filter-panel">
        <div className="fc-filter-panel__head">
          <span className="fc-filter-panel__title">{AdminI18n.t('ui.listToolbar.filters')}</span>
          {anyActive ? (
            <Button size={FieldSize.SM} variant={ButtonVariant.GHOST} onClick={this.clearAll}>{AdminI18n.t('ui.listToolbar.clearFilters')}</Button>
          ) : null}
        </div>
        <div className="fc-filter-panel__body">{this.filters.map((filter) => this.renderFilter(filter))}</div>
        <div className="fc-filter-panel__foot">
          <Button block icon={<FrameworkIcons.Check size={15} />} onClick={this.onClose}>
            {this.total === 1 ? AdminI18n.t('ui.listToolbar.showResultsOne') : AdminI18n.t('ui.listToolbar.showResults', { count: this.total })}
          </Button>
        </div>
      </div>
    );
  }
}
