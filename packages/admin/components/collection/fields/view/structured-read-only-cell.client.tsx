import { StructuredNodeKind } from '@/components/collection/fields/enums/structured-node-kind.enum';
import type { ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/react-class-components';
import { StructuredReadOnlyValue } from '@/components/collection/fields/view/structured-read-only-value.client';
import { StructuredReadOnlyFieldService } from '@/components/collection/fields/structured-read-only-field-service';
import { StructuredTableThumbnail } from '@/components/collection/fields/view/structured-table-thumbnail.client';
import type { IStructuredNode } from '@/components/collection/fields/interfaces/structured-node.interface';

/**
 * One cell of a read-only TABLE.
 *
 * A cell is read across a row, not down a column, so two values are drawn differently here than in a
 * label/value row:
 *
 * - **A folded object** (a variant's `{ Размер: "S" }`) becomes one chip per value instead of the line
 *   `Размер: S`. The key it belongs to is the column's own heading, and stays on the chip's `title`.
 * - **A picture** is the picture. A label/value row prints the thumbnail AND its address, because the
 *   address is the value; in a table that address is a column's worth of identical noise.
 *
 * Everything else is the same {@link StructuredReadOnlyValue} the rest of the control draws, so a
 * number, a date and a missing value read identically wherever they appear.
 */
export class StructuredReadOnlyCell extends PureReactor {
  @prop declare node?: IStructuredNode;
  /** Whether this cell's column holds pictures, as its values showed. */
  @prop declare media?: boolean;

  /** The entries a table cell draws as chips — present only on a value folded from an object. */
  private get chips(): Array<{ key: string; text: string }> | null {
    const node = this.node;
    if (!node || node.kind !== StructuredNodeKind.SCALAR) return null;
    const entries = node.entries ?? [];
    if (!entries.length) return null;
    const out: Array<{ key: string; text: string }> = [];
    for (const entry of entries) {
      const value = entry.node?.kind === StructuredNodeKind.SCALAR ? String(entry.node.scalarValue ?? '').trim() : '';
      out.push({ key: entry.key, text: value || entry.key });
    }
    return out;
  }

  private get imageSource(): string | null {
    const node = this.node;
    if (!node || node.kind !== StructuredNodeKind.SCALAR) return null;
    const text = String(node.scalarValue ?? '').trim();
    if (!text || !StructuredReadOnlyFieldService.isImagePath(text)) return null;
    return text;
  }

  render(): ReactNode {
    const chips = this.chips;
    if (chips) {
      return (
        <span className="fc-chips">
          {chips.map((chip) => (
            <span key={chip.key} className="fc-chip" title={`${chip.key}: ${chip.text}`}>{chip.text}</span>
          ))}
        </span>
      );
    }
    if (this.media || this.imageSource) {
      const value = this.node?.scalarValue;
      return <StructuredTableThumbnail value={value == null ? '' : String(value).trim()} />;
    }
    return <StructuredReadOnlyValue node={this.node ?? { kind: StructuredNodeKind.EMPTY }} />;
  }
}
