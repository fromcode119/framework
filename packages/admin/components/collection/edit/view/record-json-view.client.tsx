import type { ReactNode } from 'react';
import { Reactor, prop, state, bound } from '@fromcode119/react-class-components';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

/**
 * The record as editable JSON — the "advanced" half of the form/JSON view switch.
 *
 * It is the SAME record the form edits, not a copy: valid edits are pushed straight into `formData`,
 * so switching back to the form shows them immediately, and the normal Save/Commit persists them.
 * Nothing here writes to the server on its own.
 *
 * It also lists keys the form has no control for. That list is the point: a column with no field used
 * to be invisible, which is how populated product SEO columns and `invoice_date` stayed hidden.
 *
 * The draft text is held locally while typing. Re-serialising `formData` on every keystroke would
 * reformat and move the caret mid-edit, and invalid intermediate text (a half-typed string) must not
 * be pushed upstream — so the parent is only updated when the draft parses.
 */
export class RecordJsonView extends Reactor {
  @prop declare formData: Record<string, any>;
  @prop declare renderedFieldNames: string[];
  @prop declare collectionSlug: string;
  @prop declare setFormData: (value: any) => void;

  @state draft = '';
  @state error: string | null = null;
  @state notice: string | null = null;

  private fileInput = this.ref<HTMLInputElement>();

  componentDidMount(): void {
    this.draft = RecordJsonView.serialise(this.formData);
  }

  private static serialise(record: Record<string, any>): string {
    try {
      return JSON.stringify(record ?? {}, null, 2);
    } catch {
      return '{}';
    }
  }

  /**
   * The record's own bookkeeping: written when it is created and when it is saved, by the platform and
   * never by anyone at a keyboard. A form field for them would be a lie, so naming them as missing
   * fields sent the operator looking for controls that must not exist.
   */
  private static readonly WRITTEN_BY_THE_RECORD = new Set(['id', 'createdat', 'updatedat', 'tenantid']);

  /** Keys the collection declares no field for — the ones worth noticing. */
  private get unsurfacedKeys(): string[] {
    const declared = new Set((this.renderedFieldNames || []).map((name) => String(name).toLowerCase()));
    return Object.keys(this.formData || {})
      .filter((key) => !key.startsWith('_'))
      .filter((key) => !declared.has(key.toLowerCase()))
      .filter((key) => !RecordJsonView.WRITTEN_BY_THE_RECORD.has(key.toLowerCase()))
      .sort();
  }

  @bound onDraftChange(event: React.ChangeEvent<HTMLTextAreaElement>): void {
    const next = event.target.value;
    this.draft = next;
    this.notice = null;
    try {
      const parsed = JSON.parse(next);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        this.error = AdminI18n.t('collection.json.mustBeObject');
        return;
      }
      this.error = null;
      this.setFormData(parsed);
    } catch (parseError) {
      this.error = parseError instanceof Error ? parseError.message : AdminI18n.t('collection.json.invalid');
    }
  }

  /** Reformat and re-sync from the form — useful after editing fields in the normal view. */
  @bound onReformat(): void {
    this.draft = RecordJsonView.serialise(this.formData);
    this.error = null;
    this.notice = AdminI18n.t('collection.json.reloaded');
  }

  @bound onExport(): void {
    const blob = new Blob([RecordJsonView.serialise(this.formData)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${this.collectionSlug || 'record'}.json`;
    link.click();
    URL.revokeObjectURL(url);
    this.notice = AdminI18n.t('collection.json.exported');
  }

  @bound onImportClick(): void {
    this.fileInput.current?.click();
  }

  @bound async onImportFile(event: React.ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    const text = await file.text();
    try {
      const parsed = JSON.parse(text);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        this.error = AdminI18n.t('collection.json.importMustBeObject');
        return;
      }
      this.draft = RecordJsonView.serialise(parsed);
      this.error = null;
      this.setFormData(parsed);
      this.notice = AdminI18n.t('collection.json.imported', { file: file.name });
    } catch (parseError) {
      this.error = AdminI18n.t('collection.json.parseFailed', { file: file.name, reason: parseError instanceof Error ? parseError.message : AdminI18n.t('collection.json.invalid') });
    }
  }

  private highlightLayer = this.ref<HTMLPreElement>();

  /** Keep the highlighted layer aligned with the textarea while scrolling. */
  @bound onScroll(event: React.UIEvent<HTMLTextAreaElement>): void {
    const layer = this.highlightLayer.current;
    if (!layer) return;
    layer.scrollTop = event.currentTarget.scrollTop;
    layer.scrollLeft = event.currentTarget.scrollLeft;
  }

  /**
   * Minimal JSON tokeniser. No dependency: the admin bundle should not gain a syntax-highlighting
   * library for one screen, and JSON's grammar is small enough to colour with one pass.
   * Escapes first, so record content can never inject markup.
   */
  private static highlight(source: string): string {
    const escaped = source
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    return escaped.replace(
      /("(?:\\.|[^"\\])*")(\s*:)?|\b(true|false|null)\b|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/g,
      (match, str, colon, literal, num) => {
        // The four tones, measured: a key is the body text, a string green, a number or `true`
        // orange, a `null` or `false` rose, and the punctuation between them is quiet.
        if (str) {
          return colon
            ? `<span class="fc-json-key">${str}</span><span class="fc-json-punct">${colon}</span>`
            : `<span class="fc-json-str">${str}</span>`;
        }
        if (literal) return `<span class="${literal === 'true' ? 'fc-json-num' : 'fc-json-nil'}">${literal}</span>`;
        if (num) return `<span class="fc-json-num">${num}</span>`;
        return match;
      },
    );
  }

  render(): ReactNode {
    const unsurfaced = this.unsurfacedKeys;
    // The console's button, like everything else that is pressed. It stood at 9 units tall with the
    // SITE's brand radius, which is replaced at runtime, so these three changed shape per site.
    const buttonClass = 'fc-btn';

    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* No title here: the drawer's own head already carries it, and the two sat one under
              the other, the same words twice. The sentence under it stays. */}
          <p className="fc-switch__hint">{AdminI18n.t('collection.json.hint')}</p>
          <div className="flex items-center gap-2">
            <button type="button" onClick={this.onReformat} className={buttonClass}>{AdminI18n.t('collection.json.reformat')}</button>
            <button type="button" onClick={this.onImportClick} className={buttonClass}>{AdminI18n.t('collection.json.import')}</button>
            <button type="button" onClick={this.onExport} className={buttonClass}>{AdminI18n.t('common.export')}</button>
            <input
              ref={this.fileInput}
              type="file"
              accept="application/json,.json"
              onChange={this.onImportFile}
              className="hidden"
            />
          </div>
        </div>

        {unsurfaced.length > 0 && (
          <div className="fc-record-json__note">
            <p className="text-[length:var(--fc-control-text)] font-medium leading-5">
              {AdminI18n.t(unsurfaced.length === 1 ? 'collection.json.unsurfacedOne' : 'collection.json.unsurfacedMany', { count: unsurfaced.length })}
            </p>
            <p className="mt-0.5 text-[length:var(--fc-control-text)] leading-5 opacity-80">
              {AdminI18n.t('collection.json.unsurfacedHint')}
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {unsurfaced.map((key) => (
                <span key={key} className="fc-sro__chip font-mono">
                  {key}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Highlighted layer UNDER a transparent textarea: real editing (caret, selection, undo,
            IME) with colour. Both share identical font, padding and line-height, and scroll is
            synced — any mismatch shows up immediately as drifting text. */}
        <div className="fc-record-json__box" data-invalid={this.error ? 'true' : undefined}>
          <pre
            ref={this.highlightLayer}
            aria-hidden="true"
            className="fc-record-json__layer pointer-events-none absolute inset-0 m-0 overflow-hidden whitespace-pre-wrap break-words"
            dangerouslySetInnerHTML={{ __html: `${RecordJsonView.highlight(this.draft)}\n` }}
          />
          <textarea
            value={this.draft}
            onChange={this.onDraftChange}
            onScroll={this.onScroll}
            spellCheck={false}
            className="fc-record-json__layer relative w-full min-h-[60vh] resize-y overflow-auto whitespace-pre-wrap break-words bg-transparent text-transparent outline-none"
          />
        </div>

        <div className="min-h-[20px]">
          {this.error
            ? <p className="text-[length:var(--fc-control-text)] font-medium leading-5 text-[color:var(--fc-danger)]">{AdminI18n.t('collection.json.invalidState', { error: this.error })}</p>
            : <p className="text-[length:var(--fc-control-text)] leading-5 fc-tone-muted">{AdminI18n.t('collection.json.validState')}</p>}
          {this.notice && !this.error && <p className="mt-0.5 text-[length:var(--fc-control-text)] leading-5 fc-tone-muted">{this.notice}</p>}
        </div>
      </div>
    );
  }
}
