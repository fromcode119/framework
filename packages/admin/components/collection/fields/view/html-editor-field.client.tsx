import type { ReactNode } from 'react';
import { Reactor, prop, bound } from '@fromcode119/react-class-components';
import { CodeEditor } from '@/components/ui/view/code-editor.client';
import { UiFieldUtils } from '@/lib/ui';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

/**
 * Generic, framework-owned HTML editor with a live preview: the stored HTML on one side, the rendered
 * result on the other. Any plugin points a `textarea`/`text` field at it via
 * `admin.component: 'HtmlEditor'` — so a plugin whose stored value IS finished HTML (a generated email,
 * a reading) gets an editor without depending on another plugin having registered one.
 *
 * The preview iframe is fully sandboxed (no scripts, no same-origin): the HTML is rendered, never run
 * inside the admin's origin.
 */
export class HtmlEditorField extends Reactor {
  @prop declare value?: string;
  @prop declare onChange?: (value: string) => void;
  @prop declare disabled?: boolean;
  @prop declare field?: any;

  private get html(): string {
    return typeof this.value === 'string' ? this.value : '';
  }

  private get readOnly(): boolean {
    return Boolean(this.field?.admin?.readOnly) || Boolean(this.disabled);
  }

  @bound private onHtmlChange(next: string): void {
    this.onChange?.(next);
  }

  render(): ReactNode {
    const { html, readOnly } = this;
    return (
      <div className="grid gap-3 lg:grid-cols-2">
        <div className="flex min-w-0 flex-col gap-1">
          <label className={UiFieldUtils.TEXT.LABEL}>HTML</label>
          <CodeEditor value={html} onChange={this.onHtmlChange} language="html" height="480px" disabled={readOnly} />
        </div>
        <div className="flex min-w-0 flex-col gap-1">
          <label className={UiFieldUtils.TEXT.LABEL}>{AdminI18n.t('collection.edit.preview')}</label>
          <iframe
            title={AdminI18n.t('collection.edit.preview')}
            sandbox=""
            srcDoc={html}
            className="h-[480px] w-full rounded-lg border border-slate-200 bg-white shadow-sm dark:border-slate-800"
          />
        </div>
      </div>
    );
  }
}
