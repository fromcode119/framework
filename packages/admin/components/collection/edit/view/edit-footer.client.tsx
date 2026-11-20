import { ThemeMode } from '@fromcode119/core/client';
import type { ReactNode } from 'react';
import { PureReactor, prop, bound } from '@fromcode119/react-class-components';
import { CommandBar } from '@/components/ui/view/command-bar.client';
import { CommandBarCommand } from '@/components/ui/view/command-bar-command.client';
import { Input } from '@/components/ui/view/input.client';
import { FrameworkIcons } from '@fromcode119/react';
import { AdminI18n } from '@/lib/i18n/admin-i18n';
import { Spinner } from '@/components/ui/view/spinner.client';

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
  private onSummaryChange(e: any): void {
    this.setChangeSummary(e.target.value);
  }

  @bound
  private onCommit(e: any): void {
    // A refused save is already on screen (the save bar's message, the fields' errors); nothing awaits it here.
    Promise.resolve(this.handleSubmit(e, this.changeSummary)).catch(() => undefined);
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
    // The console's command bar: the same dark bar a list shows for its selection. It was a white strip
    // across the foot of the page with its own shadow, a second kind of "what can be done now".
    const status = (
      <span className="fc-edit-footer__status">
        <span className="fc-edit-footer__dot" data-dirty={this.isDirty && !this.isNew ? 'true' : 'false'} />
        {/* A new entry is always "dirty" (nothing exists on the server yet), so testing isDirty
            first made "New entry" unreachable and an untouched new form claimed unsaved changes. */}
        <span>{this.isNew ? AdminI18n.t('collection.edit.newEntry') : AdminI18n.t('collection.edit.unsavedChanges')}</span>
        {this.saveError ? <span role="alert" className="fc-edit-footer__error">{AdminI18n.t('collection.edit.notSaved', { reason: this.saveError })}</span> : null}
      </span>
    );
    return (
      <CommandBar open value={status} className="fc-edit-footer">
        {/* The note for the version history goes with the save it describes; a new record has no history yet. */}
        {this.isNew ? null : (
          <Input
            placeholder={AdminI18n.t('collection.edit.summary')}
            aria-label={AdminI18n.t('collection.edit.summary')}
            value={this.changeSummary}
            onChange={this.onSummaryChange}
            className="fc-edit-footer__summary"
          />
        )}
        <CommandBarCommand label={AdminI18n.t('collection.edit.discard')} onClick={this.onDiscard} />
        <CommandBarCommand
          label={AdminI18n.t(this.isNew ? 'common.create' : 'common.save')}
          icon={this.saving ? <Spinner /> : <FrameworkIcons.Save size={15} />}
          disabled={this.saving}
          onClick={this.onCommit}
        />
      </CommandBar>
    );
  }
}
