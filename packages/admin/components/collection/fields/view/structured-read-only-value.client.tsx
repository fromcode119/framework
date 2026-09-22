import { StructuredNodeKind } from '@/components/collection/fields/enums/structured-node-kind.enum';
import type { ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/react-class-components';
import { StructuredReadOnlyFieldService } from '@/components/collection/fields/structured-read-only-field-service';
import type { IStructuredNode } from '@/components/collection/fields/interfaces/structured-node.interface';

/**
 * Renders one SCALAR (or empty) leaf value.
 *
 * Everything here is PRESENTATION of the stored value — a boolean shown as Yes/No, a timestamp shown
 * in the reader's locale. Nothing is supplied that was not recorded: absence renders as absence, and
 * the exact stored text is always on the element's `title` so the literal value is one hover away.
 */
export class StructuredReadOnlyValue extends PureReactor {
  /** ISO-8601 with a time part — a bare `2026-06-25` is left alone, since it may be a plain date string. */
  private static readonly ISO_DATETIME_PATTERN = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}/;

  @prop declare node: IStructuredNode;
  @prop declare isDark?: boolean;

  private get valueClass(): string {
    // One weight lighter than an editable input's text (slate-800): part of what tells the operator
    // this is a record, not a form.
    return this.isDark ? 'text-slate-300' : 'text-slate-600';
  }

  private get absentClass(): string {
    return this.isDark ? 'text-slate-600' : 'text-slate-400';
  }

  /** A pill, because `true` sitting in a column of words does not read as an answer to the label. */
  private renderBoolean(value: boolean): ReactNode {
    const yes = this.isDark ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-emerald-50 text-emerald-700 border-emerald-200';
    const no = this.isDark ? 'bg-slate-800 text-slate-400 border-slate-700' : 'bg-slate-100 text-slate-500 border-slate-200';
    return (
      <span title={String(value)} className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold ${value ? yes : no}`}>
        {value ? 'Yes' : 'No'}
      </span>
    );
  }

  /**
   * A raw `2026-06-25T15:27:51.325Z` in an audit trail is a value the operator has to decode. The
   * stored string stays on `title`, so nothing is lost — and an unparseable string falls through to
   * being rendered verbatim rather than guessed at.
   */
  private renderTimestamp(text: string): ReactNode | null {
    const parsed = new Date(text);
    if (Number.isNaN(parsed.getTime())) return null;
    return <span title={text} className={this.valueClass}>{parsed.toLocaleString()}</span>;
  }

  private renderLink(text: string): ReactNode {
    const linkClass = 'break-all text-indigo-600 underline underline-offset-2 dark:text-indigo-400';
    if (StructuredReadOnlyFieldService.isImageLink(text)) {
      return (
        <span className="inline-flex items-center gap-2">
          <img src={text} alt="" className="h-12 w-12 rounded-md border border-slate-200 object-cover dark:border-slate-700" />
          <a href={text} target="_blank" rel="noopener noreferrer" className={linkClass}>{text}</a>
        </span>
      );
    }
    return <a href={text} target="_blank" rel="noopener noreferrer" className={linkClass}>{text}</a>;
  }

  render(): ReactNode {
    const { node } = this;

    if (node.kind === StructuredNodeKind.EMPTY) {
      return <span className={`text-[12px] ${this.absentClass}`}>Not recorded</span>;
    }

    const value = node.scalarValue;

    if (value === null || value === undefined) {
      return <span className={`text-[12px] ${this.absentClass}`}>Not recorded</span>;
    }

    if (typeof value === 'boolean') return this.renderBoolean(value);

    if (typeof value === 'number') {
      return <span className={`font-mono text-[12px] ${this.valueClass}`}>{String(value)}</span>;
    }

    const text = String(value);
    if (!text) return <span className={`text-[12px] ${this.absentClass}`}>Not recorded</span>;

    if (StructuredReadOnlyFieldService.isLink(text)) return this.renderLink(text);

    if (StructuredReadOnlyValue.ISO_DATETIME_PATTERN.test(text)) {
      const rendered = this.renderTimestamp(text);
      if (rendered) return rendered;
    }

    return <span className={this.valueClass}>{text}</span>;
  }
}
