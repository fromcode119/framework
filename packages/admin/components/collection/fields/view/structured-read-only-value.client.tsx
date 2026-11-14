import { StructuredNodeKind } from '@/components/collection/fields/enums/structured-node-kind.enum';
import type { ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/react-class-components';
import { StructuredReadOnlyFieldService } from '@/components/collection/fields/structured-read-only-field-service';
import type { IStructuredNode } from '@/components/collection/fields/interfaces/structured-node.interface';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

/**
 * Renders one SCALAR (or empty) leaf value.
 *
 * Everything here is PRESENTATION of the stored value — a boolean shown as Yes/No, a timestamp shown
 * in the reader's locale. Nothing is supplied that was not recorded: absence renders as absence, and
 * the exact stored text is always on the element's `title` so the literal value is one hover away.
 * A recorded value keeps the colour of an entered one (it must be read); only absence is muted.
 */
export class StructuredReadOnlyValue extends PureReactor {
  /** ISO-8601 with a time part — a bare `2026-06-25` is left alone, since it may be a plain date string. */
  private static readonly ISO_DATETIME_PATTERN = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}/;

  @prop declare node: IStructuredNode;

  private renderAbsent(): ReactNode {
    return <span className="fc-sro__absent">{AdminI18n.t('ui.structured.notRecorded')}</span>;
  }

  /**
   * A raw `2026-06-25T15:27:51.325Z` in an audit trail is a value the operator has to decode. The
   * stored string stays on `title`, so nothing is lost — and an unparseable string falls through to
   * being rendered verbatim rather than guessed at.
   */
  private renderTimestamp(text: string): ReactNode | null {
    const parsed = new Date(text);
    if (Number.isNaN(parsed.getTime())) return null;
    return <span title={text}>{parsed.toLocaleString()}</span>;
  }

  private renderLink(text: string): ReactNode {
    if (StructuredReadOnlyFieldService.isImageLink(text)) {
      return (
        <span className="fc-sro__media">
          <img src={text} alt="" className="fc-sro__thumb" />
          <a href={text} target="_blank" rel="noopener noreferrer" className="fc-sro__link">{text}</a>
        </span>
      );
    }
    return <a href={text} target="_blank" rel="noopener noreferrer" className="fc-sro__link">{text}</a>;
  }

  render(): ReactNode {
    const { node } = this;
    if (node.kind === StructuredNodeKind.EMPTY) return this.renderAbsent();

    const value = node.scalarValue;
    if (value === null || value === undefined) return this.renderAbsent();
    if (typeof value === 'boolean') return <span title={String(value)}>{AdminI18n.t(value ? 'common.yes' : 'common.no')}</span>;
    if (typeof value === 'number') return <span>{String(value)}</span>;

    const text = String(value);
    if (!text) return this.renderAbsent();
    if (StructuredReadOnlyFieldService.isLink(text)) return this.renderLink(text);
    if (StructuredReadOnlyValue.ISO_DATETIME_PATTERN.test(text)) {
      const rendered = this.renderTimestamp(text);
      if (rendered) return rendered;
    }
    return <span>{text}</span>;
  }
}
