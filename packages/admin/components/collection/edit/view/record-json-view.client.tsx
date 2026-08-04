import type { ReactNode } from 'react';
import { Reactor, prop, state, bound } from '@fromcode119/reactor';

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

  /** Keys on the record that no rendered field covers — the ones worth noticing. */
  private get unsurfacedKeys(): string[] {
    const rendered = new Set((this.renderedFieldNames || []).map((name) => String(name).toLowerCase()));
    return Object.keys(this.formData || {})
      .filter((key) => !key.startsWith('_'))
      .filter((key) => !rendered.has(key.toLowerCase()))
      .sort();
  }

  @bound onDraftChange(event: React.ChangeEvent<HTMLTextAreaElement>): void {
    const next = event.target.value;
    this.draft = next;
    this.notice = null;
    try {
      const parsed = JSON.parse(next);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        this.error = 'The record must be a JSON object.';
        return;
      }
      this.error = null;
      this.setFormData(parsed);
    } catch (parseError) {
      this.error = parseError instanceof Error ? parseError.message : 'Invalid JSON';
    }
  }

  /** Reformat and re-sync from the form — useful after editing fields in the normal view. */
  @bound onReformat(): void {
    this.draft = RecordJsonView.serialise(this.formData);
    this.error = null;
    this.notice = 'Reloaded from the form and reformatted.';
  }

  @bound onExport(): void {
    const blob = new Blob([RecordJsonView.serialise(this.formData)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${this.collectionSlug || 'record'}.json`;
    link.click();
    URL.revokeObjectURL(url);
    this.notice = 'Exported.';
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
        this.error = 'Imported file must contain a JSON object.';
        return;
      }
      this.draft = RecordJsonView.serialise(parsed);
      this.error = null;
      this.setFormData(parsed);
      this.notice = `Imported ${file.name}. Review it, then Save to persist.`;
    } catch (parseError) {
      this.error = `Could not parse ${file.name}: ${parseError instanceof Error ? parseError.message : 'invalid JSON'}`;
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
        if (str) {
          return colon
            ? `<span class="text-sky-700 dark:text-sky-300">${str}</span><span class="text-slate-400">${colon}</span>`
            : `<span class="text-emerald-700 dark:text-emerald-300">${str}</span>`;
        }
        if (literal) return `<span class="text-purple-600 dark:text-purple-300">${literal}</span>`;
        if (num) return `<span class="text-amber-600 dark:text-amber-300">${num}</span>`;
        return match;
      },
    );
  }

  render(): ReactNode {
    const unsurfaced = this.unsurfacedKeys;
    const buttonClass = 'h-9 px-3 rounded-[var(--radius)] border border-slate-200 bg-white text-[11px] font-semibold text-slate-600 transition-colors hover:border-indigo-400 hover:text-indigo-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300';

    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">Record JSON</p>
            <p className="mt-0.5 text-[12px] text-slate-500">
              Edits apply to the form immediately. Nothing is written until you Save.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={this.onReformat} className={buttonClass}>Reload &amp; format</button>
            <button type="button" onClick={this.onImportClick} className={buttonClass}>Import…</button>
            <button type="button" onClick={this.onExport} className={buttonClass}>Export</button>
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
          <div className="rounded-[var(--radius)] border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-500/20 dark:bg-amber-500/10">
            <p className="text-[12px] font-semibold text-amber-700 dark:text-amber-400">
              {unsurfaced.length} key{unsurfaced.length === 1 ? '' : 's'} the form has no control for
            </p>
            <p className="mt-0.5 text-[12px] text-amber-700/80 dark:text-amber-400/80">
              You can edit them here, but anything that matters deserves a real field.
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {unsurfaced.map((key) => (
                <span key={key} className="rounded-[var(--radius)] bg-white/70 px-2 py-1 font-mono text-[12px] text-amber-800 dark:bg-slate-900/60 dark:text-amber-300">
                  {key}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Highlighted layer UNDER a transparent textarea: real editing (caret, selection, undo,
            IME) with colour. Both share identical font, padding and line-height, and scroll is
            synced — any mismatch shows up immediately as drifting text. */}
        <div className={`relative rounded-[var(--radius)] border transition-colors ${
          this.error
            ? 'border-rose-300 bg-rose-50/40 dark:border-rose-500/40 dark:bg-rose-500/5'
            : 'border-slate-200 bg-white focus-within:border-indigo-500 dark:border-slate-700 dark:bg-slate-950'
        }`}>
          <pre
            ref={this.highlightLayer}
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 m-0 overflow-hidden whitespace-pre-wrap break-words p-4 font-mono text-[13px] leading-6 text-slate-800 dark:text-slate-100"
            dangerouslySetInnerHTML={{ __html: `${RecordJsonView.highlight(this.draft)}\n` }}
          />
          <textarea
            value={this.draft}
            onChange={this.onDraftChange}
            onScroll={this.onScroll}
            spellCheck={false}
            className="relative w-full min-h-[60vh] resize-y overflow-auto whitespace-pre-wrap break-words bg-transparent p-4 font-mono text-[13px] leading-6 text-transparent caret-slate-900 outline-none dark:caret-white"
          />
        </div>

        <div className="min-h-[20px]">
          {this.error
            ? <p className="text-[12px] font-semibold text-rose-600">Invalid JSON — {this.error}. The form keeps the last valid version.</p>
            : <p className="text-[12px] text-emerald-600">Valid JSON — the form is in sync.</p>}
          {this.notice && !this.error && <p className="mt-0.5 text-[12px] text-slate-500">{this.notice}</p>}
        </div>
      </div>
    );
  }
}
