import { ThemeMode } from '@fromcode119/core/client';
import type { ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/react-class-components';
import { Slot } from '@fromcode119/react';

import { ListShell } from '@/components/ui/view/list-shell.client';
import { CollectionListDeleteDialog } from '@/components/collection/list/view/delete-dialog.client';
import { CollectionListHeader } from '@/components/collection/list/view/list-header.client';
import { ListFooter } from '@/components/collection/list/view/list-footer.client';
import { CollectionListTable } from '@/components/collection/list/view/table.client';
import { CollectionListToolbar } from '@/components/collection/list/view/toolbar.client';

export class CollectionListPageLayout extends PureReactor {
  @prop declare collection: any;
  @prop declare pluginSlug: string;
  @prop declare slug: string;
  @prop declare slotSlug: string;
  @prop declare resolvedSlug: string;
  @prop declare total: number;
  @prop declare page: number;
  @prop declare search: string;
  @prop declare theme: ThemeMode;
  @prop declare toolbarProps: Record<string, any>;
  @prop declare tableProps: Record<string, any>;
  @prop declare footerProps: Record<string, any>;
  @prop declare deleteDialogProps: Record<string, any>;

  render(): ReactNode {
  return (
    <div className="w-full flex flex-col animate-in fade-in duration-500">
      {/* ONE card: name and actions, then the tools, then the table, then the count — the shape the
          reference gives a list. Each band is separated by the card's own hairline. */}
      <ListShell className="fc-collection-list">
        <CollectionListHeader collection={this.collection} pluginSlug={this.pluginSlug} slug={this.slug} theme={this.theme} canCreate={this.tableProps.access.canCreate} includeAction={this.tableProps.access.allowsPluginAction} handleExport={this.footerProps.handleExport} importRecords={this.footerProps.importRecords} />
        <Slot
          name={`admin.collection.${this.slotSlug}.list.header`}
          props={{ collection: this.collection, pluginSlug: this.pluginSlug, resolvedSlug: this.resolvedSlug, total: this.total, page: this.page, search: this.search }}
        />
        <CollectionListToolbar theme={this.theme} {...this.toolbarProps} />
        <CollectionListTable {...this.tableProps} />
        <ListFooter {...this.footerProps} />
      </ListShell>
      <CollectionListDeleteDialog {...this.deleteDialogProps} />
    </div>
  );
  }
}
