"use client";

import React from 'react';
import Link from 'next/link';
import { Slot } from '@fromcode119/react';
import { Copy } from 'lucide-react';

import { FrameworkIcons } from '@fromcode119/react';
import { AdminCollectionUtils } from '@/lib/collection-utils';

export function CollectionListRowActions({
  row,
  collection,
  pluginSlug,
  slug,
  slotSlug,
  resolvedSlug,
  theme,
  frontendUrl,
  permalinkStructure,
  pluginSettings,
  quickEditExpandedId,
  onQuickEditOpen,
  onDelete
}: {
  row: any;
  collection: any;
  pluginSlug: string;
  slug: string;
  slotSlug: string;
  resolvedSlug: string;
  theme: string;
  frontendUrl: string;
  permalinkStructure?: string;
  pluginSettings: Record<string, any>;
  quickEditExpandedId: string | null;
  onQuickEditOpen: (row: any, event: React.MouseEvent) => void;
  onDelete: (id: string, event: React.MouseEvent) => void;
}) {
  const canPreview = AdminCollectionUtils.supportsPreview(collection);
  const previewUrl = canPreview
    ? AdminCollectionUtils.generatePreviewUrl(frontendUrl, row, collection, permalinkStructure, pluginSettings)
    : '#';
  const duplicateHref = `/${pluginSlug}/${slug}/new?duplicateFrom=${encodeURIComponent(String(row?.id || ''))}`;

  return (
    <div className="ml-auto flex max-w-[16rem] flex-wrap items-center justify-end gap-2">
      {canPreview && (
        <a
          href={previewUrl}
          target="_blank"
          onClick={(event) => event.stopPropagation()}
          className={`p-2.5 rounded-xl transition-all ${theme === 'dark' ? 'hover:bg-indigo-500/10 text-slate-500 hover:text-indigo-400' : 'hover:bg-indigo-50 text-slate-400 hover:text-indigo-600'}`}
        >
          <FrameworkIcons.Eye size={16} />
        </a>
      )}
      <Slot
        name={`admin.collection.${slotSlug}.list.table.actions`}
        props={{ row, collection, pluginSlug, resolvedSlug }}
      />
      <Slot
        name="admin.collection.list.table.actions"
        props={{ row, collection, pluginSlug, resolvedSlug }}
      />
      <Link
        href={`/${pluginSlug}/${slug}/${row.id}`}
        onClick={(event) => event.stopPropagation()}
        className={`p-2.5 rounded-xl transition-all ${theme === 'dark' ? 'hover:bg-indigo-500/10 text-slate-500 hover:text-indigo-400' : 'hover:bg-indigo-50 text-slate-400 hover:text-indigo-600'}`}
      >
        <FrameworkIcons.Edit size={16} />
      </Link>
      <Link
        href={duplicateHref}
        onClick={(event) => event.stopPropagation()}
        className={`p-2.5 rounded-xl transition-all ${theme === 'dark' ? 'hover:bg-indigo-500/10 text-slate-500 hover:text-indigo-400' : 'hover:bg-indigo-50 text-slate-400 hover:text-indigo-600'}`}
        title="Duplicate record"
        aria-label="Duplicate record"
      >
        <Copy size={16} />
      </Link>
      <button
        onClick={(event) => onQuickEditOpen(row, event)}
        className={`p-2.5 rounded-xl transition-all ${
          quickEditExpandedId === String(row.id)
            ? theme === 'dark'
              ? 'bg-indigo-500/15 text-indigo-300'
              : 'bg-indigo-50 text-indigo-600'
            : theme === 'dark'
              ? 'hover:bg-indigo-500/10 text-slate-500 hover:text-indigo-400'
              : 'hover:bg-indigo-50 text-slate-400 hover:text-indigo-600'
        }`}
        title={quickEditExpandedId === String(row.id) ? 'Close quick edit' : 'Quick edit inline'}
      >
        <FrameworkIcons.Down
          size={16}
          className={`${quickEditExpandedId === String(row.id) ? 'rotate-180' : ''} transition-transform`}
        />
      </button>
      <button
        onClick={(event) => onDelete(String(row.id), event)}
        className={`p-2.5 rounded-xl transition-all ${theme === 'dark' ? 'hover:bg-rose-500/10 text-slate-500 hover:text-rose-400' : 'hover:bg-rose-50 text-slate-400 hover:text-rose-600'}`}
      >
        <FrameworkIcons.Trash size={16} />
      </button>
    </div>
  );
}
