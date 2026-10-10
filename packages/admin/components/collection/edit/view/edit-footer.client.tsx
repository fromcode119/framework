import { ButtonVariant } from '@/components/ui/enums/button-variant.enum';
import { ThemeMode } from '@fromcode119/core/client';
import type { ReactNode } from 'react';
import { PureReactor, prop, bound } from '@fromcode119/react-class-components';
import { Button } from '@/components/ui/view/button.client';
import { FrameworkIcons } from '@fromcode119/react';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

export class EditFooter extends PureReactor {
  @prop declare collection: any;
  @prop declare theme: ThemeMode;
  @prop declare isNew: boolean;
  @prop declare discardHref?: string;
  @prop declare handleSubmit: (e: any, summary: string) => void;
  @prop declare changeSummary: string;
  @prop declare setChangeSummary: (val: string) => void;
  @prop declare saving: boolean;
  @prop declare router: any;
  @prop declare isDirty: boolean;
  /**
   * Why the last save was refused. The body shows it too, but at the TOP of the page: an operator who
   * saved from a field further down saw nothing happen at all. This bar is always on screen.
   */
  @prop declare saveError?: string;

  /** The collection's own name for itself, as the operator sees it in the nav. */
  private get collectionName(): string {
    return this.collection.displayName || this.collection.unprefixedSlug || this.collection.shortSlug || this.collection.slug;
  }

  @bound
  private onDiscard(): void {
    if (this.discardHref) {
      this.router.push(this.discardHref);
      return;
    }
    this.router.back();
  }

  @bound
  private onCommit(e: any): void {
    this.handleSubmit(e, this.changeSummary);
    this.setChangeSummary('');
  }

  /**
   * The save bar, shown only while there is something to save: a new record, unsaved changes, or a save
   * that was refused. An untouched record shows none — a permanent bar saying "No unsaved changes" took a
   * strip of every screen, most of all a phone's, to say nothing, and repeated the header's Save.
   *
   * It is `sticky` at the bottom of the page column rather than `fixed` to the window, so it lines up
   * with the content by itself; fixed, it had to guess the menu's width and sat 80px off on a phone,
   * which has no side menu. Opaque, so nothing scrolling behind it shows through.
   */
  render(): ReactNode {
    if (!this.isDirty && !this.isNew && !this.saveError) return null;
    const dark = this.theme === ThemeMode.DARK;
    return (
      // `data-edit-footer` so anything sticky in the content column can measure this bar.
      <div data-edit-footer className={`sticky bottom-0 z-[100] mt-auto border-t ${
        dark ? 'bg-slate-950 border-slate-800' : 'bg-white border-slate-200 shadow-[0_-8px_24px_rgba(15,23,42,0.06)]'
      }`}>
        <div className="flex w-full items-center justify-between gap-3 px-4 py-2.5 sm:px-6 lg:px-8">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className={`h-2 w-2 shrink-0 rounded-full ${this.isDirty ? 'bg-amber-500' : 'bg-slate-300 dark:bg-slate-600'}`} />
              <span className="truncate text-[13px] font-medium text-slate-700 dark:text-slate-200">
                {this.isDirty || !this.isNew
                  ? AdminI18n.t('collection.edit.unsavedChanges')
                  : AdminI18n.t('collection.edit.newEntry')}
              </span>
            </div>
            {this.saveError && (
              <span role="alert" className="mt-0.5 block text-[12px] font-medium text-rose-600 dark:text-rose-400">
                {AdminI18n.t('collection.edit.notSaved', { reason: this.saveError })}
              </span>
            )}
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <Button variant={ButtonVariant.GHOST} className="h-9 px-3 text-[13px] font-medium" onClick={this.onDiscard}>
              {AdminI18n.t('collection.edit.discard')}
            </Button>
            <Button
              className="h-9 px-4 text-[13px] font-semibold"
              onClick={this.onCommit}
              isLoading={this.saving}
              icon={<FrameworkIcons.Save size={14} />}
            >
              {AdminI18n.t(this.isNew ? 'common.create' : 'common.save')}
            </Button>
          </div>
        </div>
      </div>
    );
  }
}
