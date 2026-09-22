import { StructuredNodeKind } from '@/components/collection/fields/enums/structured-node-kind.enum';
import type { ReactNode } from 'react';
import { Reactor, prop, state, bound } from '@fromcode119/react-class-components';
import { FrameworkIcons } from '@fromcode119/react';
import { StructuredReadOnlyValue } from '@/components/collection/fields/view/structured-read-only-value.client';
import { StructuredReadOnlyTable } from '@/components/collection/fields/view/structured-read-only-table.client';
import { StructuredReadOnlyFieldService } from '@/components/collection/fields/structured-read-only-field-service';
import type { IStructuredNode } from '@/components/collection/fields/interfaces/structured-node.interface';

/**
 * One row of a `StructuredReadOnlyField` tree — a scalar definition row (key left, value right), or,
 * for an object/array/array-table node, a collapsible group that recurses into itself for its
 * children. Expansion defaults to depth ≤ 2 (deeper starts collapsed) unless the whole payload is
 * "large", in which case every group starts collapsed and an active key filter forces matches open.
 */
export class StructuredReadOnlyRow extends Reactor {
  @prop declare label: string;
  @prop declare node: IStructuredNode;
  @prop declare depth: number;
  @prop declare defaultCollapsed?: boolean;
  @prop declare isDark?: boolean;
  @prop declare filterLower?: string;

  @state private expandOverride?: boolean;

  private get defaultExpanded(): boolean {
    return !this.defaultCollapsed && this.depth <= 2;
  }

  private get isExpanded(): boolean {
    return this.expandOverride === undefined ? this.defaultExpanded : this.expandOverride;
  }

  @bound
  private toggle(): void {
    this.expandOverride = !this.isExpanded;
  }

  /**
   * Nesting is expressed by indenting the LABEL, never by wrapping children in a box.
   *
   * A nested group used to render inside `ml-4 border-l pl-3`, so its children started their own
   * two-column grid at a different origin: a table inside a table, with the inner values landing in
   * a column that lined up with nothing. One grid, one value column, indentation as the only depth
   * cue — which is what the chevron already implies.
   */
  private get indent(): string {
    return `${Math.max(0, (this.depth ?? 1) - 1) * 14}px`;
  }

  private renderScalarRow(): ReactNode {
    const { label, node, isDark } = this;
    return (
      <div className={`grid md:grid-cols-[minmax(180px,240px)_1fr] items-baseline gap-x-4 gap-y-1 border-b px-3 py-2 last:border-b-0 ${isDark ? 'border-slate-800/70' : 'border-slate-100'}`}>
        <div className={`text-[11px] font-semibold ${isDark ? 'text-slate-400' : 'text-slate-500'}`} style={{ paddingLeft: this.indent }}>
          {StructuredReadOnlyFieldService.keyLabel(label)}
        </div>
        <div className="text-[12px]"><StructuredReadOnlyValue node={node} isDark={isDark} /></div>
      </div>
    );
  }

  private renderGroupChildren(): ReactNode {
    const { node, depth, defaultCollapsed, isDark, filterLower } = this;
    if (node.kind === StructuredNodeKind.ARRAY_TABLE) return <StructuredReadOnlyTable node={node} isDark={isDark} />;
    if (node.kind === StructuredNodeKind.OBJECT) {
      return (node.entries ?? []).map((entry) => (
        <StructuredReadOnlyRow key={entry.key} label={entry.key} node={entry.node} depth={depth + 1} defaultCollapsed={defaultCollapsed} isDark={isDark} filterLower={filterLower} />
      ));
    }
    return (node.items ?? []).map((item, index) => (
      <StructuredReadOnlyRow key={index} label={`[${index}]`} node={item} depth={depth + 1} defaultCollapsed={defaultCollapsed} isDark={isDark} filterLower={filterLower} />
    ));
  }

  private renderGroupRow(): ReactNode {
    const { label, node, isDark, filterLower } = this;
    const forcedOpen = Boolean(filterLower);
    const expanded = forcedOpen || this.isExpanded;
    const count = StructuredReadOnlyFieldService.topLevelCount(node);
    const isIndexed = node.kind === StructuredNodeKind.ARRAY || node.kind === StructuredNodeKind.ARRAY_TABLE;
    const countLabel = `${count} ${isIndexed ? (count === 1 ? 'item' : 'items') : (count === 1 ? 'key' : 'keys')}`;

    return (
      <>
        <div className={`border-b px-3 last:border-b-0 ${isDark ? 'border-slate-800/70' : 'border-slate-100'}`}>
          <button
            type="button"
            onClick={this.toggle}
            disabled={forcedOpen}
            className={`flex w-full items-center gap-1.5 py-2 text-left text-[11px] font-bold ${isDark ? 'text-slate-300 hover:text-slate-100' : 'text-slate-600 hover:text-slate-900'}`}
            style={{ paddingLeft: this.indent }}
          >
            {expanded ? <FrameworkIcons.ChevronDown size={12} /> : <FrameworkIcons.ChevronRight size={12} />}
            <span>{StructuredReadOnlyFieldService.keyLabel(label)}</span>
            <span className={`font-normal ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>({countLabel})</span>
          </button>
        </div>
        {expanded ? this.renderGroupChildren() : null}
      </>
    );
  }

  render(): ReactNode {
    const { label, node, filterLower } = this;
    if (filterLower && !StructuredReadOnlyFieldService.matchesFilter(label, node, filterLower)) return null;
    return node.kind === StructuredNodeKind.SCALAR || node.kind === StructuredNodeKind.EMPTY ? this.renderScalarRow() : this.renderGroupRow();
  }
}
