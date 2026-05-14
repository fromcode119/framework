"use client";

import React from 'react';
import { Slot } from '@fromcode119/react';

import { CollectionListDeleteDialog } from './delete-dialog';
import { CollectionListHeader } from './list-header';
import { ListFooter } from './list-footer';
import { CollectionListTable } from './table';
import { CollectionListToolbar } from './toolbar';

export function CollectionListPageLayout({
  collection,
  pluginSlug,
  slug,
  slotSlug,
  resolvedSlug,
  total,
  page,
  search,
  theme,
  toolbarProps,
  tableProps,
  footerProps,
  deleteDialogProps
}: {
  collection: any;
  pluginSlug: string;
  slug: string;
  slotSlug: string;
  resolvedSlug: string;
  total: number;
  page: number;
  search: string;
  theme: string;
  toolbarProps: Record<string, any>;
  tableProps: Record<string, any>;
  footerProps: Record<string, any>;
  deleteDialogProps: Record<string, any>;
}) {
  return (
    <div className="w-full min-h-screen flex flex-col animate-in fade-in duration-500">
      <CollectionListHeader collection={collection} pluginSlug={pluginSlug} slug={slug} theme={theme} />
      <div className="flex-1 w-full px-6 lg:px-12 py-12 space-y-8">
        <Slot
          name={`admin.collection.${slotSlug}.list.header`}
          props={{ collection, pluginSlug, resolvedSlug, total, page, search }}
        />
        <CollectionListToolbar theme={theme} {...toolbarProps} />
        <CollectionListTable {...tableProps} />
      </div>
      <ListFooter {...footerProps} />
      <CollectionListDeleteDialog {...deleteDialogProps} />
    </div>
  );
}
