import type { ReactNode, RefObject } from 'react';
import { PureReactor, prop } from '@fromcode119/react-class-components';
import { FrameworkIcons } from '@fromcode119/react';
import { Dropdown } from '@/components/ui/view/dropdown.client';
import { HorizontalAlign } from '@/components/ui/enums/horizontal-align.enum';
import { AdminClass } from '@/lib/admin-class';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

/**
 * A section's ⋯: everything that section can be asked to do. Editing is its first item, and under it
 * what a part or a plugin offers (a refund under the payments). Every card head therefore carries ONE
 * control, of one shape, in one place — which is the point: a head that sometimes held a text button,
 * sometimes a button and a ⋯, and sometimes nothing read as three different designs on one page.
 *
 * The offers are drawn once into a hidden probe, out of sight, to learn whether there are any.
 */
export class RecordSectionMenu extends PureReactor {
  @prop declare editable: boolean;
  @prop declare hasOffers: boolean;
  @prop declare offers: () => ReactNode;
  @prop declare probeRef: RefObject<HTMLSpanElement | null>;
  @prop declare onEdit: () => void;

  render(): ReactNode {
    const card = AdminClass.of('record-card');
    const label = AdminI18n.t('collection.edit.sectionActions');
    const probe = <span key="probe" ref={this.probeRef} hidden>{this.offers()}</span>;
    if (!this.hasOffers && !this.editable) return probe;
    const items = this.editable
      ? [{ label: AdminI18n.t('collection.edit.editSection'), onClick: this.onEdit, icon: <FrameworkIcons.Edit size={14} /> }]
      : [];
    return [probe,
      <Dropdown
        key="menu"
        align={HorizontalAlign.RIGHT}
        items={items}
        footer={this.offers()}
        trigger={
          <button type="button" aria-label={label} title={label} className={`${card}__menu`}>
            <FrameworkIcons.More size={18} />
          </button>
        }
      />];
  }
}
