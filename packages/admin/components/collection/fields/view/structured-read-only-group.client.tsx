import { StructuredNodeKind } from '@/components/collection/fields/enums/structured-node-kind.enum';
import type { ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/react-class-components';
import { StructuredReadOnlyBlock } from '@/components/collection/fields/view/structured-read-only-block.client';
import { StructuredReadOnlyList } from '@/components/collection/fields/view/structured-read-only-list.client';
import { StructuredReadOnlyTable } from '@/components/collection/fields/view/structured-read-only-table.client';
import { StructuredReadOnlyFieldService } from '@/components/collection/fields/structured-read-only-field-service';
import type { IStructuredEntry } from '@/components/collection/fields/interfaces/structured-entry.interface';
import type { IStructuredNode } from '@/components/collection/fields/interfaces/structured-node.interface';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

/**
 * One level of the value tree: this level's leaves as label / value rows, then each nested object or
 * array under a heading of its own that recurses.
 *
 * Nesting is a HEADING, not a collapsed row: an eight-key delivery address hidden behind a disclosure
 * on a page whose whole job is to show what was recorded is data the operator never sees.
 *
 * A heading per level reads well while the value is shallow. A courier's answer is not — provider data,
 * response payload, shipment statuses, [0], status: six headings deep, each indented further, turning one
 * recorded field into a page of staircase. From the third level down the keys are JOINED into the row's
 * own label (`Response payload › Shipment statuses › [0] › Status`) and the rows read as one list. Every
 * value is still on screen, under a name that says exactly where it came from — nothing is collapsed.
 */
export class StructuredReadOnlyGroup extends PureReactor {
  /** From this depth down, a nested object's keys are joined into the row label instead of a heading. */
  private static readonly JOIN_FROM_DEPTH = 2;

  @prop declare node: IStructuredNode;
  @prop declare depth: number;
  @prop declare filterLower?: string;
  @prop declare keyLabels?: Record<string, string>;
  /** The names of the levels above, already joined; empty at the top. */
  @prop declare prefix?: string;

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

  /** This row's name: its own key at the top levels, the path to it once the levels are joined. */
  private label(key: string): string {
    const own = StructuredReadOnlyFieldService.keyLabel(key, this.keyLabels);
    return this.prefix ? `${this.prefix} › ${own}` : own;
  }

  /** A nested value drawn with no heading of its own — its keys carry the path instead. */
  private renderJoined(entry: IStructuredEntry): ReactNode {
    return (
      <StructuredReadOnlyGroup
        key={entry.key}
        node={entry.node}
        depth={this.depth + 1}
        prefix={this.label(entry.key)}
        filterLower={this.filterLower}
        keyLabels={this.keyLabels}
      />
    );
  }

  private renderChild(entry: IStructuredEntry): ReactNode {
    const { depth, filterLower, keyLabels } = this;
    const count = StructuredReadOnlyFieldService.topLevelCount(entry.node);
    return (
      <section key={entry.key} className="fc-sro__section">
        <h3 className="fc-sro__heading">
          {this.label(entry.key)}
          {count ? <span className="fc-sro__count">{count}</span> : null}
        </h3>
        {entry.node.kind === StructuredNodeKind.ARRAY_TABLE
          ? <StructuredReadOnlyTable node={entry.node} keyLabels={keyLabels} />
          : StructuredReadOnlyFieldService.isValueList(entry.node)
            ? <StructuredReadOnlyList node={entry.node} />
            : <StructuredReadOnlyGroup node={entry.node} depth={depth + 1} filterLower={filterLower} keyLabels={keyLabels} />}
      </section>
    );
  }

  render(): ReactNode {
    const visible = this.visibleEntries;
    if (!visible.length) return <p className="fc-sro__absent">{AdminI18n.t('ui.structured.noMatch')}</p>;
    const leaves = visible.filter((entry) => StructuredReadOnlyGroup.isLeaf(entry.node));
    const children = visible.filter((entry) => !StructuredReadOnlyGroup.isLeaf(entry.node));
    return (
      <>
        {leaves.length ? (
          <dl className="fc-sro__rows">
            {leaves.map((entry) => <StructuredReadOnlyBlock key={entry.key} label={this.label(entry.key)} node={entry.node} />)}
          </dl>
        ) : null}
        {children.map((entry) => (this.depth >= StructuredReadOnlyGroup.JOIN_FROM_DEPTH
          && !StructuredReadOnlyFieldService.isValueList(entry.node)
          && entry.node.kind !== StructuredNodeKind.ARRAY_TABLE
          ? this.renderJoined(entry)
          : this.renderChild(entry)))}
      </>
    );
  }
}
