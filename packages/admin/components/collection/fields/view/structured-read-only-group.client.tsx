import { StructuredNodeKind } from '@/components/collection/fields/enums/structured-node-kind.enum';
import type { ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/react-class-components';
import { StructuredReadOnlyBlock } from '@/components/collection/fields/view/structured-read-only-block.client';
import { StructuredReadOnlyTable } from '@/components/collection/fields/view/structured-read-only-table.client';
import { StructuredReadOnlyFieldService } from '@/components/collection/fields/structured-read-only-field-service';
import type { IStructuredEntry } from '@/components/collection/fields/interfaces/structured-entry.interface';
import type { IStructuredNode } from '@/components/collection/fields/interfaces/structured-node.interface';

/**
 * One level of the value tree: this level's leaves in a grid, then each nested object/array below it
 * as a captioned subsection that recurses.
 *
 * Nesting is a CAPTION AND A RULE, not a collapsed row. Every group used to start as a chevron the
 * operator had to click — an eight-key delivery address hidden behind a disclosure on a page whose
 * whole job is to show what was recorded. A caption costs one line and shows the data.
 */
export class StructuredReadOnlyGroup extends PureReactor {
  @prop declare node: IStructuredNode;
  @prop declare depth: number;
  @prop declare isDark?: boolean;
  @prop declare filterLower?: string;
  @prop declare keyLabels?: Record<string, string>;

  /** Object entries and array items reach this component as the same shape. */
  private get entries(): IStructuredEntry[] {
    const { node } = this;
    if (node.kind === StructuredNodeKind.OBJECT) return node.entries ?? [];
    return (node.items ?? []).map((item, index) => ({ key: `[${index}]`, node: item }));
  }

  private get visibleEntries(): IStructuredEntry[] {
    const filterLower = this.filterLower;
    if (!filterLower) return this.entries;
    return this.entries.filter((entry) => StructuredReadOnlyFieldService.matchesFilter(entry.key, entry.node, filterLower));
  }

  private static isLeaf(node: IStructuredNode): boolean {
    return node.kind === StructuredNodeKind.SCALAR || node.kind === StructuredNodeKind.EMPTY;
  }

  private renderLeaves(leaves: IStructuredEntry[]): ReactNode {
    if (!leaves.length) return null;
    return (
      // `minmax(0,1fr)`, never a bare `1fr`: a bare track is `min-width:auto`, so one long unbroken
      // value (a URL, an address) widens its column and pushes the grid past the panel.
      <div className="grid grid-cols-[repeat(auto-fit,minmax(170px,1fr))] gap-x-7 gap-y-3.5">
        {leaves.map((entry) => (
          <StructuredReadOnlyBlock key={entry.key} label={entry.key} node={entry.node} isDark={this.isDark} keyLabels={this.keyLabels} />
        ))}
      </div>
    );
  }

  private renderCaption(entry: IStructuredEntry): ReactNode {
    const { isDark } = this;
    const count = StructuredReadOnlyFieldService.topLevelCount(entry.node);
    return (
      <div className="mb-2.5 flex items-center gap-2.5">
        <span className={`whitespace-nowrap text-[9px] font-bold uppercase tracking-[0.09em] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
          {StructuredReadOnlyFieldService.keyLabel(entry.key, this.keyLabels)}
        </span>
        <span className={`h-px flex-1 ${isDark ? 'bg-slate-800' : 'bg-slate-200'}`} />
        {count ? <span className={`text-[10px] ${isDark ? 'text-slate-600' : 'text-slate-300'}`}>{count}</span> : null}
      </div>
    );
  }

  private renderChild(entry: IStructuredEntry): ReactNode {
    const { depth, isDark, filterLower, keyLabels } = this;
    return (
      <div key={entry.key} className="mt-5 first:mt-0">
        {this.renderCaption(entry)}
        {entry.node.kind === StructuredNodeKind.ARRAY_TABLE
          ? <StructuredReadOnlyTable node={entry.node} isDark={isDark} keyLabels={keyLabels} />
          : <StructuredReadOnlyGroup node={entry.node} depth={depth + 1} isDark={isDark} filterLower={filterLower} keyLabels={keyLabels} />}
      </div>
    );
  }

  render(): ReactNode {
    const visible = this.visibleEntries;
    const leaves = visible.filter((entry) => StructuredReadOnlyGroup.isLeaf(entry.node));
    const children = visible.filter((entry) => !StructuredReadOnlyGroup.isLeaf(entry.node));

    if (!visible.length) {
      return <p className={`text-[12px] font-medium ${this.isDark ? 'text-slate-500' : 'text-slate-400'}`}>Nothing matches that filter.</p>;
    }

    return (
      <>
        {this.renderLeaves(leaves)}
        {children.length ? (
          <div className={leaves.length ? 'mt-5' : ''}>
            {children.map((entry) => this.renderChild(entry))}
          </div>
        ) : null}
      </>
    );
  }
}
