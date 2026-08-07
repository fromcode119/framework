import { FieldSize } from '@/components/ui/enums/field-size.enum';
import { ThemeMode } from '@fromcode119/core/client';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { PureReactor, prop, bound } from '@fromcode119/reactor';
import { Slot } from '@fromcode119/react';
import { FrameworkIcons } from '@fromcode119/react';
import { Button } from '@/components/ui/view/button.client';
import { Input } from '@/components/ui/view/input.client';
import { Select } from '@/components/ui/view/select.client';
import { CollectionListUtils } from '@/components/collection/list/utils';

export class EditHeader extends PureReactor {
  @prop declare collection: any;
  @prop declare pluginSlug: string;
  @prop declare slug: string;
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
      <div className="w-full px-6 lg:px-8 py-4">
        <div className="flex items-center gap-2 mb-2">
          <Link 
            href={`/${pluginSlug}/${slug}`}
            className={`flex items-center gap-1.5 text-[10px] font-semibold transition-all hover:-translate-x-1 ${theme === ThemeMode.DARK ? 'text-slate-500' : 'text-slate-400'}`}
          >
            <FrameworkIcons.Left size={14} />
            {collectionLabel}
          </Link>
          <span className="text-slate-300">/</span>
          <span className={`text-[10px] font-semibold ${theme === ThemeMode.DARK ? 'text-slate-300' : 'text-slate-500'}`}>
            {isNew ? 'New Entry' : [resolvedTitleValue, `#${id.length > 8 ? `${id.substring(0, 8)}…` : id}`].filter(Boolean).join(' · ')}
          </span>
        </div>

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className={`text-xl font-bold tracking-tight leading-tight ${theme === ThemeMode.DARK ? 'text-white' : 'text-slate-900'}`}>
              {isNew
                ? `Create ${singularCollectionLabel}`
                : (resolvedTitleValue || `Untitled ${singularCollectionLabel}`)
              }
            </h1>
            <p className="text-slate-500 font-medium text-xs tracking-tight mt-0.5">
              {isNew ? `Define a new record for ${collectionLabel.toLowerCase()}` : `Modify existing ${resolvedTitleValue || singularCollectionLabel.toLowerCase()}`}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {!isNew && (
              <div className="hidden lg:block relative group">
                 <Input 
                    placeholder="Commit summary (optional)"
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
                className={`box-border appearance-none h-10 px-4 rounded-[var(--radius)] outline-none border transition-all duration-200 shadow-sm inline-flex items-center justify-center gap-2 leading-none text-[10px] font-semibold ${
                  theme === ThemeMode.DARK 
                    ? 'bg-slate-900/60 border-slate-800 text-slate-300 hover:border-indigo-500/50 hover:text-white focus:border-indigo-500 focus:ring-0'
                    : 'bg-white border-slate-200 text-slate-700 hover:border-indigo-500 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10'
                }`}
              >
                <FrameworkIcons.Eye size={14} />
                Preview
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
                  className="w-full md:w-40 lg:w-44"
                  triggerClassName="h-10 px-4 text-sm font-bold rounded-[var(--radius)]"
                />
              </div>
            )}

            {/* Form vs JSON used to sit here. It moved to EditViewModeRail: this row is a plugin
                extension point (the Slots below), so its contents vary per collection and per installed
                plugin — a core view-mode switch must not compete with actions it does not control. */}
            <Slot
              name={`admin.collection.${slug}.edit.header.actions`}
              props={{ collection, formData, setFormData, isNew, handleSubmit, saving }}
            />
            <Slot
              name="admin.collection.edit.header.actions"
              props={{ collection, formData, setFormData, isNew, handleSubmit, saving }}
            />
             
            {!hideHeaderPrimaryAction && (
              <Button 
                className="h-10 px-6 font-semibold text-[10px] shadow-lg shadow-indigo-600/20" 
                onClick={this.onSave}
                isLoading={saving}
                icon={<FrameworkIcons.Save size={14} />}
              >
                {isNew ? 'Create' : 'Save'}
              </Button>
            )}

            {!isNew && (
              <button 
                onClick={this.onDelete}
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
