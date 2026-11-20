import type { KeyboardEvent, MouseEvent, ReactNode } from 'react';
import { ThemeMode } from '@fromcode119/core/client';
import { PureReactor, prop, state, bound } from '@fromcode119/react-class-components';
import { FrameworkIcons, RootFramework } from '@fromcode119/react';
import { FieldRenderer } from '@/components/collection/view/field-renderer.client';
import { RecordOperations } from '@/components/collection/list/record-operations';
import { AdminI18n } from '@/lib/i18n/admin-i18n';
import { Button } from '@/components/ui/view/button.client';
import { ButtonVariant } from '@/components/ui/enums/button-variant.enum';
import { MenuAction } from '@/components/ui/view/menu-action.client';

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

  /**
   * A single-value select with declared options is picked, not edited: its choices show as buttons and
   * one tap saves — a status changes in one step instead of open, choose, Save. A select drawn by its
   * own component keeps that component.
   */
  private get choices(): { label: string; value: string }[] {
    const field = this.field;
    if (field.type !== 'select' || field.hasMany || field.admin?.component || !Array.isArray(field.options)) return [];
    return field.options.map((option: any) => ({ label: String(option?.label ?? option?.value ?? option), value: String(option?.value ?? option) }));
  }

  @bound private pick(value: string): void {
    this.value = value;
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
          style={{ position: 'fixed', top: this.coords.top, left: this.coords.left, width: this.choices.length ? 240 : 300 }}
          className="fc-menu-sheet z-[9998] rounded-xl p-3"
        >
          {this.loading ? (
            <p className="py-3 text-center fc-size-xs font-medium fc-tone-muted">{AdminI18n.t('collection.quickEdit.loading')}</p>
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
          {this.error ? <p className="mt-2 fc-size-xs font-medium fc-tone-danger">{this.error}</p> : null}
          {this.choices.length && !this.loading ? null : <div className="mt-3 flex items-center justify-end gap-2">
            <Button type="button" variant={ButtonVariant.SECONDARY} onClick={this.close}>
              {AdminI18n.t('common.cancel')}
            </Button>
            <Button type="button" variant={ButtonVariant.PRIMARY} isLoading={this.saving} disabled={this.loading} onClick={this.save}>
              {AdminI18n.t('common.save')}
            </Button>
          </div>}
        </div>
      </RootFramework>
    );
  }

  private renderChoices(): ReactNode {
    const current = String(this.value ?? '');
    return (
      <div>
        <p className="mb-2 fc-size-xs font-medium fc-tone-muted">{this.field.label || this.field.name}</p>
        <div className="flex flex-col">
          {this.choices.map((choice) => (
            <MenuAction
              key={choice.value}
              label={String(choice.label)}
              current={choice.value === current}
              isLoading={this.saving && choice.value === this.value}
              end={choice.value === current ? <FrameworkIcons.Check size={14} /> : null}
              onClick={() => this.pick(choice.value)}
            />
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
              ? 'fc-tone-brand-edge fc-tone-brand-soft'
              : 'border-transparent fc-tone-hover-brand-line fc-tone-hover-brand-soft'
          }`}
        >
          {this.children}
        </button>
        {this.open ? this.renderPanel() : null}
      </>
    );
  }
}
