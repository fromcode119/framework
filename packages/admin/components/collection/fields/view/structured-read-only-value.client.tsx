import { StructuredNodeKind } from '@/components/collection/fields/enums/structured-node-kind.enum';
import type { ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/react-class-components';
import { StructuredReadOnlyFieldService } from '@/components/collection/fields/structured-read-only-field-service';
import type { IStructuredNode } from '@/components/collection/fields/interfaces/structured-node.interface';

/**
 * Renders one SCALAR (or empty) leaf value of a `StructuredReadOnlyField` tree: a plain string, a
 * mono-styled number/boolean/null, an `—` for an empty string, or — because customer-submitted photo
 * lists and image-size maps are exactly what this field exists to make legible — a link (and, for an
 * image URL, a small thumbnail beside it).
 */
export class StructuredReadOnlyValue extends PureReactor {
  @prop declare node: IStructuredNode;
  @prop declare isDark?: boolean;

  render(): ReactNode {
    const { node, isDark } = this;
    // Mono keeps numbers and booleans scannable in a column, but they used to carry the MUTED colour
    // too, so a real value — an amount, a tax rate — read as fainter than the strings beside it. Only
    // absence is secondary here; a value is a value whatever its type.
    const monoClass = `font-mono text-[11px] ${isDark ? 'text-slate-200' : 'text-slate-700'}`;
    const absentClass = isDark ? 'text-slate-600' : 'text-slate-400';

    if (node.kind === StructuredNodeKind.EMPTY) {
      return <span className={absentClass}>—</span>;
    }

    const value = node.scalarValue;

    if (value === null || value === undefined) {
      return <span className={`font-mono text-[11px] ${absentClass}`}>null</span>;
    }

    if (typeof value === 'boolean' || typeof value === 'number') {
      return <span className={monoClass}>{String(value)}</span>;
    }

    const text = String(value);

    if (!text) {
      return <span className={absentClass}>—</span>;
    }

    if (StructuredReadOnlyFieldService.isImageLink(text)) {
      return (
        <span className="inline-flex items-center gap-2">
          <img src={text} alt="" className="h-12 w-12 rounded-md border border-slate-200 object-cover dark:border-slate-700" />
          <a href={text} target="_blank" rel="noopener noreferrer" className="break-all text-indigo-600 underline underline-offset-2 dark:text-indigo-400">{text}</a>
        </span>
      );
    }

    if (StructuredReadOnlyFieldService.isLink(text)) {
      return (
        <a href={text} target="_blank" rel="noopener noreferrer" className="break-all text-indigo-600 underline underline-offset-2 dark:text-indigo-400">{text}</a>
      );
    }

    return <span className={isDark ? 'text-slate-200' : 'text-slate-700'}>{text}</span>;
  }
}
