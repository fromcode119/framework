import type { ReactNode } from 'react';
import { Reactor, state, bound } from '@fromcode119/react-class-components';
import { FrameworkIcons } from '@fromcode119/react';
import { Button } from '@/components/ui/view/button.client';
import { ButtonVariant } from '@/components/ui/enums/button-variant.enum';
import { RecordCard } from '@/components/ui/view/record-card.client';
import { DataTable } from '@/components/ui/view/data-table.client';
import { CommandBar } from '@/components/ui/view/command-bar.client';
import { CommandBarCommand } from '@/components/ui/view/command-bar-command.client';
import { Dropdown } from '@/components/ui/view/dropdown.client';
import { HorizontalAlign } from '@/components/ui/enums/horizontal-align.enum';
import { DropdownItemVariant } from '@/components/ui/enums/dropdown-item-variant.enum';
import { ConfirmDialog } from '@/components/ui/view/confirm-dialog.client';
import { PromptDialog } from '@/components/ui/view/prompt-dialog.client';
import { EditSheet } from '@/components/ui/view/edit-sheet.client';
import { FocusModal } from '@/components/ui/view/focus-modal.client';
import { Input } from '@/components/ui/view/input.client';
import { StatCard } from '@/components/ui/view/stat-card.client';
import { AdminFactGrid } from '@/components/ui/view/admin-fact-grid.client';
import { StateBadge } from '@/components/ui/view/state-badge.client';
import { NotificationType } from '@/components/enums/notification-type.enum';
import { NotificationContextStore } from '@/components/view/notification-context-store.client';
import type { INotificationContextType } from '@/components/interfaces/notification-context-type.interface';

/** The kit's surfaces: cards and rows, a table, the menu, and everything that opens over the page. */
export class KitSurfaces extends Reactor {
  static contextType = NotificationContextStore.context;
  declare context: INotificationContextType | undefined;

  @state private open = '';
  @state private selected: string[] = [];

  @bound private close(): void { this.open = ''; }
  @bound private select(ids: string[]): void { this.selected = ids; }
  @bound private clearSelection(): void { this.selected = []; }
  private opener(name: string): () => void { return () => { this.open = name; }; }
  private toast(type: NotificationType, title: string, message: string): () => void {
    return () => this.context?.notify(type, title, message);
  }

  private block(name: string, children: ReactNode): ReactNode {
    return (
      <RecordCard title={name} id={`kit-${name.toLowerCase().replace(/[^a-z]+/g, '-')}`}>
        <div className="fc-kit__row">{children}</div>
      </RecordCard>
    );
  }

  render(): ReactNode {
    const rows = [
      { id: '1', name: 'Cotton T-shirt', collection: 'Summer', variants: '8 variants', status: 'Published' },
      { id: '2', name: 'Winter jacket', collection: '-', variants: '4 variants', status: 'Draft' },
    ];
    const columns = [
      { header: 'Product', id: 'name', accessor: (row: any) => row.name },
      { header: 'Collection', id: 'collection', accessor: (row: any) => row.collection },
      { header: 'Variants', id: 'variants', accessor: (row: any) => row.variants },
      { header: 'Status', id: 'status', accessor: (row: any) => <StateBadge tone={row.status === 'Published' ? 'success' : 'warning'}>{row.status}</StateBadge> },
    ];
    const menu = [
      { label: 'Edit', icon: <FrameworkIcons.Edit size={15} />, onClick: this.close },
      { label: 'Duplicate', icon: <FrameworkIcons.Copy size={15} />, onClick: this.close },
      { label: 'Delete', icon: <FrameworkIcons.Trash size={15} />, variant: DropdownItemVariant.DANGER, onClick: this.close },
    ];
    return (
      <>
        <RecordCard title="Card with rows" id="kit-card-rows" count={3} menu={<span className="fc-record-card__menu"><FrameworkIcons.More size={15} /></span>}>
          <dl className="fc-record-card__rows">
            <div className="fc-record-card__row"><dt className="fc-record-card__label">Description</dt><dd className="fc-record-card__value">Made of organic cotton, pre-washed, with a round neck.</dd></div>
            <div className="fc-record-card__row"><dt className="fc-record-card__label">Handle</dt><dd className="fc-record-card__value">/cotton-t-shirt</dd></div>
            <div className="fc-record-card__row"><dt className="fc-record-card__label">Material</dt><dd className="fc-record-card__value">-</dd></div>
          </dl>
        </RecordCard>
        <RecordCard title="DataTable" id="kit-datatable">
          <DataTable columns={columns as any} data={rows} selectable selectedIds={this.selected} onSelectionChange={this.select} totalDocs={2} limit={20} page={1} onPageChange={() => undefined} />
        </RecordCard>
        <CommandBar open={this.selected.length > 0} value={`${this.selected.length} selected`}>
          <CommandBarCommand label="Publish" onClick={this.clearSelection} />
          <CommandBarCommand label="Export" icon={<FrameworkIcons.Download size={15} />} onClick={this.clearSelection} />
          <CommandBarCommand label="Delete" icon={<FrameworkIcons.Trash size={15} />} onClick={this.clearSelection} />
          <CommandBarCommand label={<FrameworkIcons.Close size={15} />} title="Clear selection" onClick={this.clearSelection} />
        </CommandBar>
        {this.block('Dropdown', (
          <Dropdown align={HorizontalAlign.LEFT} items={menu} trigger={<span className="fc-toolbar-btn"><FrameworkIcons.More size={15} />Menu</span>} />
        ))}
        {this.block('Overlays', (
          <>
            <Button variant={ButtonVariant.SECONDARY} onClick={this.opener('confirm')}>Confirm</Button>
            <Button variant={ButtonVariant.SECONDARY} onClick={this.opener('prompt')}>Prompt</Button>
            <Button variant={ButtonVariant.SECONDARY} onClick={this.opener('sheet')}>Sheet</Button>
            <Button variant={ButtonVariant.SECONDARY} onClick={this.opener('focus')}>Focus modal</Button>
          </>
        ))}
        {this.block('Toast', (
          <>
            <Button variant={ButtonVariant.SECONDARY} onClick={this.toast(NotificationType.SUCCESS, 'Saved', 'The product was saved.')}>Success</Button>
            <Button variant={ButtonVariant.SECONDARY} onClick={this.toast(NotificationType.ERROR, 'Not saved', 'The price is required.')}>Error</Button>
            <Button variant={ButtonVariant.SECONDARY} onClick={this.toast(NotificationType.INFO, 'Heads up', 'A new version is available.')}>Info</Button>
          </>
        ))}
        {this.block('StatCard', (
          <>
            <div className="fc-kit__cell"><StatCard title="Orders" value="128" icon={<FrameworkIcons.Clock size={18} />} trend={{ value: 12, isPositive: true }} /></div>
            <div className="fc-kit__cell"><StatCard title="Returns" value="3" icon={<FrameworkIcons.Refresh size={18} />} trend={{ value: 2, isPositive: false }} /></div>
          </>
        ))}
        {this.block('AdminFactGrid', (
          <div className="fc-kit__cell fc-kit__cell--wide">
            <AdminFactGrid facts={[{ key: 'a', label: 'Weight', value: '400 g' }, { key: 'b', label: 'Origin', value: 'Bulgaria' }, { key: 'c', label: 'HS code', value: '6109.10', note: 'Checked on export' }]} />
          </div>
        ))}
        <ConfirmDialog isOpen={this.open === 'confirm'} onClose={this.close} onConfirm={this.close} title="Delete the product?" description="This removes the product and its variants. It cannot be undone." confirmLabel="Delete" variant={ButtonVariant.DANGER} />
        <PromptDialog isOpen={this.open === 'prompt'} onClose={this.close} onConfirm={this.close} title="Rename" description="The name shown in the list." defaultValue="Cotton T-shirt" />
        <EditSheet isOpen={this.open === 'sheet'} onClose={this.close} onSave={this.close} title="Edit product" subtitle="Cotton T-shirt">
          <div className="fc-field-stack"><Input label="Title" value="Cotton T-shirt" onChange={() => undefined} /></div>
        </EditSheet>
        <FocusModal isOpen={this.open === 'focus'} label="Create product" onClose={this.close} onConfirm={this.close}>
          <div className="fc-kit__cell"><Input label="Title" value="" placeholder="Winter jacket" onChange={() => undefined} /></div>
        </FocusModal>
      </>
    );
  }
}
