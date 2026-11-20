import type { KeyboardEvent, MouseEvent, ReactNode } from 'react';
import { ThemeMode } from '@fromcode119/core/client';
import { PureReactor, prop, state, bound } from '@fromcode119/react-class-components';
import { FrameworkIcons, RootFramework } from '@fromcode119/react';
import { FieldRenderer } from '@/components/collection/view/field-renderer.client';
import { RecordOperations } from '@/components/collection/list/record-operations';
import { AdminI18n } from '@/lib/i18n/admin-i18n';
import { ConfirmDialog } from '@/components/ui/view/confirm-dialog.client';
import { ButtonVariant } from '@/components/ui/enums/button-variant.enum';
import { CollectionEditDerivations } from '@/components/collection/edit/view/collection-edit-derivations.client';

/**
 * A list value that becomes its own control when clicked: the price, the stock, the status.
 *
 * It loads the record before editing, as the quick edit form does, because a list row carries the
 * value in the console's language only — saving that back would overwrite every other language of a
 * localized field. The popover draws through the portal so the table's sideways scroll cannot clip it.
 */
export class InlineEditValue extends PureReactor {
  declare props: Pick<InlineEditValue, 'row' | 'field' | 'resolvedSlug' | 'theme' | 'pluginSettings' | 'onSaved' | 'children'>;

  @prop declare row: any;
  @prop declare field: any;
  @prop declare resolvedSlug: string;
  @prop declare theme: ThemeMode;
  @prop declare pluginSettings: Record<string, any>;
  /** Called after a save, so the list can reload the row. */
  @prop declare onSaved: () => void;
  @prop declare children: ReactNode;

  @state open = false;
  @state loading = false;
  @state saving = false;
  @state value: any = undefined;
  @state initial: any = undefined;
  /** The whole record, for a control that reads its siblings. */
  @state record: Record<string, any> = {};
  @state error = '';
  @state coords = { top: 0, left: 0 };
  /** A choice that declares `confirm`, waiting for the operator to agree to what it does. */
  @state asked: { label: string; value: string; tone: string; confirm: string } | null = null;
  /** Where the trigger sat when the popover opened, to place it above when there is no room below. */
  private anchor: DOMRect | null = null;

  private trigger = this.ref<HTMLButtonElement>();
  private panel = this.ref<HTMLDivElement>();

  componentDidMount(): void {
    this.listen(document, 'mousedown', this.handleOutside);
    this.listen(document, 'keydown', this.handleEscape);
  }

  /** Escape closes the popover wherever the focus is: a list of choices takes no focus when it opens. */
  @bound private handleEscape(event: Event): void {
    if (!this.open || this.saving || this.asked || (event as globalThis.KeyboardEvent).key !== 'Escape') return;
    this.close();
  }

  /**
   * The popover opens below the value; on the last rows of a list that is past the bottom of the window
   * and its choices could not be reached. Once it has a height it moves above the value instead.
   */
  componentDidUpdate(): void {
    const panel = this.panel.current;
    if (!this.open || !panel || !this.anchor) return;
    const height = panel.getBoundingClientRect().height;
    const below = this.anchor.bottom + 6;
    const top = below + height > window.innerHeight - 8 ? Math.max(8, this.anchor.top - height - 6) : below;
    if (top !== this.coords.top) this.coords = { ...this.coords, top };
  }

  /** A click anywhere but the popover — or a menu the popover opened, which also lives in the portal — closes it. */
  @bound private handleOutside(event: Event): void {
    if (!this.open || this.saving || this.asked) return;
    const target = event.target as Node;
    if (this.panel.current?.contains(target) || this.trigger.current?.contains(target)) return;
    if (document.getElementById('portal-root')?.contains(target)) return;
    this.close();
  }

  @bound private async start(event: MouseEvent): Promise<void> {
    event.stopPropagation();
    if (this.open) return this.close();
    const rect = this.trigger.current?.getBoundingClientRect();
    this.anchor = rect || null;
    const width = 300;
    this.coords = rect
      ? { top: rect.bottom + 6, left: Math.max(8, Math.min(rect.left, window.innerWidth - width - 8)) }
      : { top: 0, left: 0 };
    this.patch({ open: true, loading: true, error: '' });
    try {
      const record = await RecordOperations.fetchQuickEditRecord(this.resolvedSlug, String(this.row.id));
      const value = record?.[this.field.name];
      this.patch({ value, initial: value, record: record || {}, loading: false });
    } catch (error: any) {
      this.patch({ loading: false, error: error?.message || AdminI18n.t('collection.list.quickEditLoadFailed') });
    }
  }

  @bound private close(): void {
    this.patch({ open: false, error: '', saving: false, asked: null });
  }

  @bound private change(value: any): void {
    this.value = value;
  }

  /**
   * A single-value select with declared options is picked, not edited: its choices show as buttons and
   * one tap saves — a status changes in one step instead of open, choose, Save. A select drawn by its
   * own component keeps that component.
   *
   * The choices follow the record page's rules: an option that declares `reachableFrom` is offered only
   * from those values (the list offered "Refunded" on a pending order, which the server then refused), and
   * one that declares `confirm` says what it does before it is saved, as the record page's status menu does.
   */
  private get choices(): { label: string; value: string; tone: string; confirm: string }[] {
    const field = this.field;
    if (field.type !== 'select' || field.hasMany || field.admin?.component || !Array.isArray(field.options)) return [];
    return CollectionEditDerivations.reachableFieldOptions(field.options, this.initial).map((option: any) => ({
      label: String(option?.label ?? option?.value ?? option),
      value: String(option?.value ?? option),
      tone: String(option?.tone ?? ''),
      confirm: String(option?.confirm ?? ''),
    }));
  }

  @bound private pick(event: MouseEvent): void {
    const value = (event.currentTarget as HTMLButtonElement).value;
    const choice = this.choices.find((candidate) => candidate.value === value);
    if (choice?.confirm && value !== String(this.initial ?? '')) {
      this.asked = choice;
      return;
    }
    this.value = value;
    void this.save();
  }

  @bound private dismissAsked(): void {
    if (!this.saving) this.asked = null;
  }

  @bound private confirmAsked(): void {
    if (!this.asked) return;
    this.value = this.asked.value;
    void this.save();
  }

  @bound private async save(): Promise<void> {
    if (JSON.stringify(this.value) === JSON.stringify(this.initial)) return this.close();
    this.patch({ saving: true, error: '' });
    try {
      await RecordOperations.saveQuickEditRecord(this.resolvedSlug, String(this.row.id), { [this.field.name]: this.value });
      this.close();
      this.onSaved();
    } catch (error: any) {
      // The refusal shows in the popover, so a confirmation still open over it is closed.
      this.patch({ saving: false, asked: null, error: error?.message || AdminI18n.t('collection.list.quickEditSaveFailed') });
    }
  }

  @bound private handleKey(event: KeyboardEvent): void {
    if (event.key === 'Enter' && (event.target as HTMLElement).tagName !== 'TEXTAREA') {
      event.preventDefault();
      void this.save();
    }
  }

  @bound private stop(event: MouseEvent): void {
    event.stopPropagation();
  }

  private renderPanel(): ReactNode {
    return (
      <RootFramework>
        <div
          ref={this.panel}
          onClick={this.stop}
          onKeyDown={this.handleKey}
          style={{ position: 'fixed', top: this.coords.top, left: this.coords.left, width: this.choices.length ? 240 : 300 }}
          className="z-[9998] rounded-xl border p-3 shadow-xl bg-white border-slate-200 shadow-slate-900/10 dark:bg-slate-900 dark:border-slate-700"
        >
          {this.loading ? (
            <p className="py-3 text-center text-[12px] font-medium text-slate-400">{AdminI18n.t('collection.quickEdit.loading')}</p>
          ) : this.choices.length ? this.renderChoices() : (
            <FieldRenderer
              field={this.field}
              value={this.value}
              onChange={this.change}
              theme={this.theme as any}
              collectionSlug={this.resolvedSlug}
              pluginSettings={this.pluginSettings}
              isNew={false}
              record={this.record}
            />
          )}
          {this.error ? <p className="mt-2 text-[12px] font-medium text-rose-600">{this.error}</p> : null}
          {this.choices.length && !this.loading ? null : <div className="mt-3 flex items-center justify-end gap-2">
            <button type="button" onClick={this.close} className="h-8 px-3 rounded-lg border text-[12px] font-medium border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">
              {AdminI18n.t('common.cancel')}
            </button>
            <button type="button" onClick={this.save} disabled={this.loading || this.saving} className="h-8 px-3 rounded-lg text-[12px] font-medium inline-flex items-center gap-1.5 bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-60">
              <FrameworkIcons.Check size={13} />
              {AdminI18n.t(this.saving ? 'collection.quickEdit.saving' : 'common.save')}
            </button>
          </div>}
        </div>
      </RootFramework>
    );
  }

  private renderChoices(): ReactNode {
    const current = String(this.value ?? '');
    return (
      <div>
        <p className="mb-2 text-[12px] font-medium text-slate-500 dark:text-slate-400">{this.field.label || this.field.name}</p>
        <div className="flex flex-col gap-1">
          {this.choices.map((choice) => (
            <button
              key={choice.value}
              type="button"
              value={choice.value}
              onClick={this.pick}
              disabled={this.saving}
              aria-pressed={choice.value === current}
              className={`h-9 px-3 rounded-lg text-start text-[13px] font-medium inline-flex items-center justify-between transition-colors disabled:opacity-60 ${
                choice.value === current
                  ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300'
                  : 'text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800'
              }`}
            >
              {choice.label}
              {choice.value === current ? <FrameworkIcons.Check size={14} /> : null}
            </button>
          ))}
        </div>
      </div>
    );
  }

  render(): ReactNode {
    return (
      <>
        <button
          type="button"
          ref={this.trigger}
          onClick={this.start}
          title={AdminI18n.t('collection.list.inlineEditHint', { label: this.field.label || this.field.name })}
          className={`-mx-1.5 -my-0.5 px-1.5 py-0.5 rounded-md border border-dashed text-start transition-colors ${
            this.open
              ? 'border-indigo-400 bg-indigo-50 dark:bg-indigo-500/10'
              : 'border-transparent hover:border-indigo-300 hover:bg-indigo-50/60 dark:hover:border-indigo-500/50 dark:hover:bg-indigo-500/10'
          }`}
        >
          {this.children}
        </button>
        {/* While a choice is being confirmed the dialog alone is on screen; the popover returns if it is cancelled. */}
        {this.open && !this.asked ? this.renderPanel() : null}
        {this.asked ? (
          // The dialog draws through the portal, but its clicks still bubble up the React tree to the row,
          // which opened the record on Cancel.
          <span onClick={this.stop} className="contents">
          <ConfirmDialog isOpen onClose={this.dismissAsked} onConfirm={this.confirmAsked}
            title={AdminI18n.t('collection.edit.statusConfirm', { status: this.asked.label })}
            description={this.asked.confirm} isLoading={this.saving}
            variant={this.asked.tone === 'danger' ? ButtonVariant.DANGER : ButtonVariant.PRIMARY} />
          </span>
        ) : null}
      </>
    );
  }
}
