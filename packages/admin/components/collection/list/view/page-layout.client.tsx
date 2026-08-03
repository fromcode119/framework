import { ThemeMode } from '@fromcode119/core/client';
import type { ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/reactor';
import { Slot } from '@fromcode119/react';

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
    <div className="w-full min-h-screen flex flex-col animate-in fade-in duration-500">
      <CollectionListHeader collection={this.collection} pluginSlug={this.pluginSlug} slug={this.slug} theme={this.theme} />
      <div className="flex-1 w-full px-6 lg:px-12 py-12 space-y-8">
        <Slot
          name={`admin.collection.${this.slotSlug}.list.header`}
          props={{ collection: this.collection, pluginSlug: this.pluginSlug, resolvedSlug: this.resolvedSlug, total: this.total, page: this.page, search: this.search }}
        />
        <CollectionListToolbar theme={this.theme} {...this.toolbarProps} />
        <CollectionListTable {...this.tableProps} />
      </div>
      <ListFooter {...this.footerProps} />
      <CollectionListDeleteDialog {...this.deleteDialogProps} />
    </div>
  );
  }
}
