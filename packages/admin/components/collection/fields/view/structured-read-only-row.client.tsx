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

  private renderScalarRow(): ReactNode {
    const { label, node, isDark } = this;
    return (
      <div className={`grid md:grid-cols-[minmax(160px,220px)_1fr] items-baseline gap-x-3 gap-y-1 border-b py-2 ${isDark ? 'border-slate-900' : 'border-slate-100'}`}>
        <div className={`font-mono text-[11px] font-semibold ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{label}</div>
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
      <div className={`border-b py-1 ${isDark ? 'border-slate-900' : 'border-slate-100'}`}>
        <button
          type="button"
          onClick={this.toggle}
          disabled={forcedOpen}
          className={`flex w-full items-center gap-1.5 py-1.5 text-left text-[11px] font-bold ${isDark ? 'text-slate-300 hover:text-slate-100' : 'text-slate-600 hover:text-slate-900'}`}
        >
          {expanded ? <FrameworkIcons.ChevronDown size={12} /> : <FrameworkIcons.ChevronRight size={12} />}
          <span className="font-mono">{label}</span>
          <span className={`font-normal ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>({countLabel})</span>
        </button>
        {expanded ? <div className={`ml-4 border-l pl-3 ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>{this.renderGroupChildren()}</div> : null}
      </div>
    );
  }

  render(): ReactNode {
    const { label, node, filterLower } = this;
    if (filterLower && !StructuredReadOnlyFieldService.matchesFilter(label, node, filterLower)) return null;
    return node.kind === StructuredNodeKind.SCALAR || node.kind === StructuredNodeKind.EMPTY ? this.renderScalarRow() : this.renderGroupRow();
  }
}
