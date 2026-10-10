import type { KeyboardEvent, MouseEvent, ReactNode } from 'react';
import { ThemeMode } from '@fromcode119/core/client';
import { PureReactor, prop, state, bound } from '@fromcode119/react-class-components';
import { FrameworkIcons, RootFramework } from '@fromcode119/react';
import { FieldRenderer } from '@/components/collection/view/field-renderer.client';
import { RecordOperations } from '@/components/collection/list/record-operations';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

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

  private trigger = this.ref<HTMLButtonElement>();
  private panel = this.ref<HTMLDivElement>();

  componentDidMount(): void {
    this.listen(document, 'mousedown', this.handleOutside);
  }

  /** A click anywhere but the popover — or a menu the popover opened, which also lives in the portal — closes it. */
  @bound private handleOutside(event: Event): void {
    if (!this.open || this.saving) return;
    const target = event.target as Node;
    if (this.panel.current?.contains(target) || this.trigger.current?.contains(target)) return;
    if (document.getElementById('portal-root')?.contains(target)) return;
    this.close();
  }

  @bound private async start(event: MouseEvent): Promise<void> {
    event.stopPropagation();
    if (this.open) return this.close();
    const rect = this.trigger.current?.getBoundingClientRect();
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
    this.patch({ open: false, error: '', saving: false });
  }

  @bound private change(value: any): void {
    this.value = value;
  }

  @bound private async save(): Promise<void> {
    if (JSON.stringify(this.value) === JSON.stringify(this.initial)) return this.close();
    this.patch({ saving: true, error: '' });
    try {
      await RecordOperations.saveQuickEditRecord(this.resolvedSlug, String(this.row.id), { [this.field.name]: this.value });
      this.close();
      this.onSaved();
    } catch (error: any) {
      this.patch({ saving: false, error: error?.message || AdminI18n.t('collection.list.quickEditSaveFailed') });
    }
  }

  @bound private handleKey(event: KeyboardEvent): void {
    if (event.key === 'Escape') this.close();
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
          style={{ position: 'fixed', top: this.coords.top, left: this.coords.left, width: 300 }}
          className="z-[9998] rounded-xl border p-3 shadow-xl bg-white border-slate-200 shadow-slate-900/10 dark:bg-slate-900 dark:border-slate-700"
        >
          {this.loading ? (
            <p className="py-3 text-center text-[12px] font-semibold text-slate-400">{AdminI18n.t('collection.quickEdit.loading')}</p>
          ) : (
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
          {this.error ? <p className="mt-2 text-[12px] font-semibold text-rose-600">{this.error}</p> : null}
          <div className="mt-3 flex items-center justify-end gap-2">
            <button type="button" onClick={this.close} className="h-8 px-3 rounded-lg border text-[12px] font-semibold border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">
              {AdminI18n.t('common.cancel')}
            </button>
            <button type="button" onClick={this.save} disabled={this.loading || this.saving} className="h-8 px-3 rounded-lg text-[12px] font-semibold inline-flex items-center gap-1.5 bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-60">
              <FrameworkIcons.Check size={13} />
              {AdminI18n.t(this.saving ? 'collection.quickEdit.saving' : 'common.save')}
            </button>
          </div>
        </div>
      </RootFramework>
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
          className={`-mx-1.5 -my-0.5 px-1.5 py-0.5 rounded-md border border-dashed text-left transition-colors ${
            this.open
              ? 'border-indigo-400 bg-indigo-50 dark:bg-indigo-500/10'
              : 'border-transparent hover:border-indigo-300 hover:bg-indigo-50/60 dark:hover:border-indigo-500/50 dark:hover:bg-indigo-500/10'
          }`}
        >
          {this.children}
        </button>
        {this.open ? this.renderPanel() : null}
      </>
    );
  }
}
