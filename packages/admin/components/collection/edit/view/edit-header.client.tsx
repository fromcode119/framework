import { FieldSize } from '@/components/ui/enums/field-size.enum';
import { ThemeMode, CollectionArchive } from '@fromcode119/core/client';
import { EditArchiveControl } from '@/components/collection/edit/view/edit-archive-control.client';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { PureReactor, prop, bound, state } from '@fromcode119/react-class-components';
import { AdminServices } from '@/lib/admin-services';
import { Slot } from '@fromcode119/react';
import { FrameworkIcons } from '@fromcode119/react';
import { Button } from '@/components/ui/view/button.client';
import { Input } from '@/components/ui/view/input.client';
import { Select } from '@/components/ui/view/select.client';
import { CollectionListUtils } from '@/components/collection/list/utils';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

export class EditHeader extends PureReactor {
  @prop declare collection: any;
  @prop declare pluginSlug: string;
  @prop declare slug: string;
  /** Where this tab last showed the list (its page); read after mount, so server and client render alike. */
  @state listHref = '';

  componentDidMount(): void {
    this.listHref = AdminServices.getInstance().uiPreference.readCollectionListHref(this.pluginSlug, this.slug);
  }
  @prop declare id: string;
  @prop declare isNew: boolean;
  @prop declare theme: ThemeMode;
  @prop declare resolvedTitleValue: string;
  @prop declare changeSummary: string;
  @prop declare setChangeSummary: (val: string) => void;
  @prop declare formData: any;
  @prop declare setFormData: (value: any) => void;
  @prop declare getPreviewUrl: () => string;
  @prop declare showPreview: boolean;
  @prop declare statusOptions: { label: string; value: string }[];
  @prop declare currentStatusValue: string;
  @prop declare handleInputChange: (name: string, value: any) => void;
  @prop declare handleSubmit: (e: any, summary: string) => void;
  @prop declare saving: boolean;
  @prop declare setShowDeleteConfirm: (val: boolean) => void;
  /** Whether the signed-in user may save this record (create when new, update otherwise). */
  @prop declare canSave: boolean;
  /** Whether the signed-in user may delete it. */
  @prop declare canDelete: boolean;
  /** Which plugin-contributed header actions to offer — see `CollectionAccess.allowsPluginAction`. */
  @prop declare includeAction: (contribution: { pluginSlug: string }) => boolean;

  get collectionLabel(): string {
    return CollectionListUtils.resolveCollectionLabel(this.collection, this.slug);
  }

  get singularCollectionLabel(): string {
    return CollectionListUtils.resolveCollectionSingularLabel(this.collection, this.slug);
  }

  get hideHeaderPrimaryAction(): boolean {
    return this.collection?.admin?.hideHeaderPrimaryAction === true;
  }

  @bound onSummaryChange(e: any): void {
    this.setChangeSummary(e.target.value);
  }

  @bound onStatusChange(value: any): void {
    this.handleInputChange('status', value);
  }

  @bound onSave(e: any): void {
    this.handleSubmit(e, this.changeSummary);
    this.setChangeSummary('');
  }

  @bound onDelete(): void {
    this.setShowDeleteConfirm(true);
  }

  render(): ReactNode {
  const {
  collection,
  pluginSlug,
  slug,
  id,
  isNew,
  theme,
  resolvedTitleValue,
  changeSummary,
  formData,
  setFormData,
  getPreviewUrl,
  showPreview,
  statusOptions,
  currentStatusValue,
  handleSubmit,
  saving,
} = this;
  const collectionLabel = this.collectionLabel;
  const singularCollectionLabel = this.singularCollectionLabel;
  const hideHeaderPrimaryAction = this.hideHeaderPrimaryAction;

  return (
    <div data-edit-header className="sticky top-0 z-40 border-b backdrop-blur bg-white/90 border-slate-100 dark:bg-slate-950/80 dark:border-slate-800/60">
      <div className="w-full px-4 sm:px-6 lg:px-8 py-3 md:py-4">
        <div className="flex items-center gap-2 mb-2">
          <Link 
            href={this.listHref || `/${pluginSlug}/${slug}`}
            className={`flex items-center gap-1.5 text-[10px] font-semibold transition-all hover:-translate-x-1 ${theme === ThemeMode.DARK ? 'text-slate-500' : 'text-slate-400'}`}
          >
            <FrameworkIcons.Left size={14} />
            {collectionLabel}
          </Link>
          {/* On a phone the back link is enough: the title right below already names the record. */}
          <span className="hidden md:inline text-slate-300">/</span>
          <span className={`hidden md:inline text-[10px] font-semibold ${theme === ThemeMode.DARK ? 'text-slate-300' : 'text-slate-500'}`}>
            {isNew ? AdminI18n.t('collection.edit.newEntry') : [resolvedTitleValue, `#${id.length > 8 ? `${id.substring(0, 8)}…` : id}`].filter(Boolean).join(' · ')}
          </span>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* The title takes the room the actions leave and ends in "…" when longer; below its minimum the
              actions wrap under it. A long product name used to squeeze this column to one word per line. */}
          <div className="min-w-[16rem] flex-1">
            <h1 title={isNew ? undefined : resolvedTitleValue || undefined} className={`truncate text-lg md:text-xl font-bold tracking-tight leading-tight ${theme === ThemeMode.DARK ? 'text-white' : 'text-slate-900'}`}>
              {isNew
                ? AdminI18n.t('collection.edit.createTitle', { name: singularCollectionLabel, label: collectionLabel })
                : (resolvedTitleValue || AdminI18n.t('collection.edit.untitled', { name: singularCollectionLabel }))
              }
            </h1>
            {/* Only a new record gets a line under its title. On an existing one it said "Modify existing
                <title>" — the title a third time, after the breadcrumb and the heading. */}
            {isNew ? (
              <p className="truncate text-slate-500 font-medium text-xs tracking-tight mt-0.5">
                {AdminI18n.t('collection.edit.newSubtitle', { name: collectionLabel.toLowerCase(), label: collectionLabel })}
              </p>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {!isNew && (
              <div className="hidden lg:block relative group">
                 <Input 
                    placeholder={AdminI18n.t('collection.edit.summary')}
                    value={changeSummary}
                    onChange={this.onSummaryChange}
                    className="w-48 xl:w-64"
                    inputClassName="text-[10px] font-semibold h-10 bg-transparent border-slate-200 dark:border-slate-800 transition-all placeholder:opacity-50"
                 />
              </div>
            )}
            {formData?.scheduledPublishAt && (formData.status === 'draft' || !formData.status) && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-500 font-semibold text-[10px] animate-pulse">
                <FrameworkIcons.Clock size={12} />
                {new Date(formData.scheduledPublishAt).toLocaleDateString()}
              </div>
            )}
            {showPreview && (
              <a 
                href={getPreviewUrl()}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={AdminI18n.t('collection.edit.preview')}
                className={`box-border appearance-none h-10 px-4 rounded-[var(--radius)] outline-none border transition-all duration-200 shadow-sm inline-flex items-center justify-center gap-2 leading-none text-[10px] font-semibold ${
                  theme === ThemeMode.DARK 
                    ? 'bg-slate-900/60 border-slate-800 text-slate-300 hover:border-indigo-500/50 hover:text-white focus:border-indigo-500 focus:ring-0'
                    : 'bg-white border-slate-200 text-slate-700 hover:border-indigo-500 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10'
                }`}
              >
                <FrameworkIcons.Eye size={14} />
                {/* Icon only on a phone, so the whole action row fits on one line. */}
                <span className="hidden sm:inline">{AdminI18n.t('collection.edit.preview')}</span>
              </a>
            )}
            {statusOptions.length > 0 && (
              <div className="flex items-center gap-2">
                <Select
                  value={currentStatusValue || statusOptions[0].value}
                  onChange={this.onStatusChange}
                  options={statusOptions}
                  searchable={false}
                  size={FieldSize.MD}
                  className="w-32 sm:w-40 lg:w-44"
                  triggerClassName="h-10 px-3 sm:px-4 text-sm font-bold rounded-[var(--radius)]"
                />
              </div>
            )}

            {/* Form vs JSON used to sit here. It moved to EditViewModeRail: this row is a plugin
                extension point (the Slots below), so its contents vary per collection and per installed
                plugin — a core view-mode switch must not compete with actions it does not control. */}
            <Slot
              name={`admin.collection.${slug}.edit.header.actions`}
              include={this.includeAction}
              props={{ collection, formData, setFormData, isNew, handleSubmit, saving }}
            />
            <Slot
              name="admin.collection.edit.header.actions"
              include={this.includeAction}
              props={{ collection, formData, setFormData, isNew, handleSubmit, saving }}
            />
             
            {!hideHeaderPrimaryAction && this.canSave && (
              <Button 
                className="h-10 px-4 sm:px-6 font-semibold text-[12px] shadow-lg shadow-indigo-600/20" 
                onClick={this.onSave}
                isLoading={saving}
                icon={<FrameworkIcons.Save size={14} />}
              >
                {AdminI18n.t(isNew ? 'common.create' : 'common.save')}
              </Button>
            )}

            {!isNew && this.canSave && CollectionArchive.isArchivable(collection) && (
              <EditArchiveControl collection={collection} id={this.id} theme={theme} formData={formData} setFormData={this.setFormData} />
            )}

            {!isNew && this.canDelete && (
              <button 
                onClick={this.onDelete}
                aria-label={AdminI18n.t('common.delete')}
                className={`h-10 w-10 inline-flex items-center justify-center rounded-[var(--radius)] border border-rose-100 bg-rose-50 text-rose-500 hover:bg-rose-500 hover:text-white transition-all shadow-sm ${theme === ThemeMode.DARK ? 'bg-rose-500/10 border-rose-500/20' : ''}`}
              >
                <FrameworkIcons.Trash size={16} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
  }
}
