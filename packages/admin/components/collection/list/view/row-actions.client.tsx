import type { CollectionAccess } from '@/lib/collection-access';
import { ThemeMode } from '@fromcode119/core/client';
import type { MouseEvent, ReactNode } from 'react';
import Link from 'next/link';
import { PureReactor, prop } from '@fromcode119/react-class-components';
import { Slot } from '@fromcode119/react';
import { Archive, ArchiveRestore, Copy } from 'lucide-react';
import { CollectionArchive } from '@fromcode119/core/client';

import { FrameworkIcons } from '@fromcode119/react';
import { AdminCollectionUtils } from '@/lib/collection-utils';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

export class CollectionListRowActions extends PureReactor {
  /** JSX props — the declared @prop fields, so call sites are type-checked without a <Props> generic. */
  declare props: Pick<CollectionListRowActions, 'row' | 'collection' | 'pluginSlug' | 'slug' | 'slotSlug' | 'resolvedSlug' | 'theme' | 'frontendUrl' | 'permalinkStructure' | 'pluginSettings' | 'quickEditExpandedId' | 'onQuickEditOpen' | 'onDelete' | 'onArchive' | 'access'>;

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
  @prop declare onArchive?: (id: string, archiving: boolean) => void;
  /** What the signed-in user may do to this record — decides which actions are offered. */
  @prop declare access: CollectionAccess;

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
  onDelete,
  access
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
        include={access.allowsPluginAction}
        props={{ row, collection, pluginSlug, resolvedSlug }}
      />
      <Slot
        name="admin.collection.list.table.actions"
        include={access.allowsPluginAction}
        props={{ row, collection, pluginSlug, resolvedSlug }}
      />
      <Link
        href={`/${pluginSlug}/${slug}/${row.id}`}
        onClick={(event) => event.stopPropagation()}
        className={`p-2.5 rounded-xl transition-all ${theme === ThemeMode.DARK ? 'hover:bg-indigo-500/10 text-slate-500 hover:text-indigo-400' : 'hover:bg-indigo-50 text-slate-400 hover:text-indigo-600'}`}
      >
        <FrameworkIcons.Edit size={16} />
      </Link>
      {access.canCreate ? <Link
        href={duplicateHref}
        onClick={(event) => event.stopPropagation()}
        className={`p-2.5 rounded-xl transition-all ${theme === ThemeMode.DARK ? 'hover:bg-indigo-500/10 text-slate-500 hover:text-indigo-400' : 'hover:bg-indigo-50 text-slate-400 hover:text-indigo-600'}`}
        title={AdminI18n.t('collection.list.duplicate')}
        aria-label={AdminI18n.t('collection.list.duplicate')}
      >
        <Copy size={16} />
      </Link> : null}
      {access.canUpdate ? <button
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
        title={AdminI18n.t(quickEditExpandedId === String(row.id) ? 'collection.list.quickEditClose' : 'collection.list.quickEditOpen')}
      >
        <FrameworkIcons.Down
          size={16}
          className={`${quickEditExpandedId === String(row.id) ? 'rotate-180' : ''} transition-transform`}
        />
      </button> : null}
      {access.canUpdate && this.onArchive ? (() => {
        const archived = CollectionArchive.isArchived(row);
        const label = AdminI18n.t(archived ? 'collection.list.restore' : 'collection.list.archive');
        return <button
          onClick={(event) => {
            event.stopPropagation();
            this.onArchive?.(String(row.id), !archived);
          }}
          className={`p-2.5 rounded-xl transition-all ${theme === ThemeMode.DARK ? 'hover:bg-amber-500/10 text-slate-500 hover:text-amber-400' : 'hover:bg-amber-50 text-slate-400 hover:text-amber-600'}`}
          title={label}
          aria-label={label}
        >
          {archived ? <ArchiveRestore size={16} /> : <Archive size={16} />}
        </button>;
      })() : null}
      {access.canDelete ? <button
        onClick={(event) => onDelete(String(row.id), event)}
        className={`p-2.5 rounded-xl transition-all ${theme === ThemeMode.DARK ? 'hover:bg-rose-500/10 text-slate-500 hover:text-rose-400' : 'hover:bg-rose-50 text-slate-400 hover:text-rose-600'}`}
      >
        <FrameworkIcons.Trash size={16} />
      </button> : null}
    </div>
  );
  }
}
