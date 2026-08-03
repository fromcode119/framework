import { ThemeMode } from '@fromcode119/core/client';
import type { MouseEvent, ReactNode } from 'react';
import Link from 'next/link';
import { PureReactor, prop } from '@fromcode119/reactor';
import { Slot } from '@fromcode119/react';
import { Copy } from 'lucide-react';

import { FrameworkIcons } from '@fromcode119/react';
import { AdminCollectionUtils } from '@/lib/collection-utils';

export class CollectionListRowActions extends PureReactor {
  /** JSX props — the declared @prop fields, so call sites are type-checked without a <Props> generic. */
  declare props: Pick<CollectionListRowActions, 'row' | 'collection' | 'pluginSlug' | 'slug' | 'slotSlug' | 'resolvedSlug' | 'theme' | 'frontendUrl' | 'permalinkStructure' | 'pluginSettings' | 'quickEditExpandedId' | 'onQuickEditOpen' | 'onDelete'>;

  @prop declare row: any;
  @prop declare collection: any;
  @prop declare pluginSlug: string;
  @prop declare slug: string;
  @prop declare slotSlug: string;
  @prop declare resolvedSlug: string;
  @prop declare theme: ThemeMode;
  @prop declare frontendUrl: string;
  @prop declare permalinkStructure?: string;
  @prop declare pluginSettings: Record<string, any>;
  @prop declare quickEditExpandedId: string | null;
  @prop declare onQuickEditOpen: (row: any, event: MouseEvent) => void;
  @prop declare onDelete: (id: string, event: MouseEvent) => void;

  render(): ReactNode {
    const {
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
} = this;
  const canPreview = AdminCollectionUtils.supportsPreview(collection);
  const previewUrl = canPreview
    ? AdminCollectionUtils.generatePreviewUrl(frontendUrl, row, collection, permalinkStructure, pluginSettings)
    : '#';
  const duplicateHref = `/${pluginSlug}/${slug}/new?duplicateFrom=${encodeURIComponent(String(row?.id || ''))}`;

  return (
    <div className="ml-auto flex flex-nowrap items-center justify-end gap-1 whitespace-nowrap">
      {canPreview && (
        <a
          href={previewUrl}
          target="_blank"
          onClick={(event) => event.stopPropagation()}
          className={`p-2.5 rounded-xl transition-all ${theme === ThemeMode.DARK ? 'hover:bg-indigo-500/10 text-slate-500 hover:text-indigo-400' : 'hover:bg-indigo-50 text-slate-400 hover:text-indigo-600'}`}
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
        className={`p-2.5 rounded-xl transition-all ${theme === ThemeMode.DARK ? 'hover:bg-indigo-500/10 text-slate-500 hover:text-indigo-400' : 'hover:bg-indigo-50 text-slate-400 hover:text-indigo-600'}`}
      >
        <FrameworkIcons.Edit size={16} />
      </Link>
      <Link
        href={duplicateHref}
        onClick={(event) => event.stopPropagation()}
        className={`p-2.5 rounded-xl transition-all ${theme === ThemeMode.DARK ? 'hover:bg-indigo-500/10 text-slate-500 hover:text-indigo-400' : 'hover:bg-indigo-50 text-slate-400 hover:text-indigo-600'}`}
        title="Duplicate record"
        aria-label="Duplicate record"
      >
        <Copy size={16} />
      </Link>
      <button
        onClick={(event) => onQuickEditOpen(row, event)}
        className={`p-2.5 rounded-xl transition-all ${
          quickEditExpandedId === String(row.id)
            ? theme === ThemeMode.DARK
              ? 'bg-indigo-500/15 text-indigo-300'
              : 'bg-indigo-50 text-indigo-600'
            : theme === ThemeMode.DARK
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
        className={`p-2.5 rounded-xl transition-all ${theme === ThemeMode.DARK ? 'hover:bg-rose-500/10 text-slate-500 hover:text-rose-400' : 'hover:bg-rose-50 text-slate-400 hover:text-rose-600'}`}
      >
        <FrameworkIcons.Trash size={16} />
      </button>
    </div>
  );
  }
}
