import { StructuredNodeKind } from '@/components/collection/fields/enums/structured-node-kind.enum';
import { ThemeMode } from '@fromcode119/core/client';
import type { ReactNode } from 'react';
import { Reactor, prop, state, bound } from '@fromcode119/react-class-components';
import { Input } from '@/components/ui/view/input.client';
import { StructuredReadOnlyBlock } from '@/components/collection/fields/view/structured-read-only-block.client';
import { StructuredReadOnlyGroup } from '@/components/collection/fields/view/structured-read-only-group.client';
import { StructuredReadOnlyTable } from '@/components/collection/fields/view/structured-read-only-table.client';
import { StructuredReadOnlyList } from '@/components/collection/fields/view/structured-read-only-list.client';
import { StructuredReadOnlyTableService } from '@/components/collection/fields/structured-read-only-table-service';
import { StructuredReadOnlyFieldService } from '@/components/collection/fields/structured-read-only-field-service';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

/**
 * Framework-owned, read-only renderer for structured/JSON field values — the legible replacement for
 * the raw JSON textarea. Any plugin field sets `admin.component: 'StructuredReadOnlyField'` (the
 * field's OWN `admin.readOnly`/runtime writes the value; this component never calls `onChange`).
 * Registered at admin bootstrap.
 *
 * It draws the value as the label / value rows a saved record's card lists its fields in, with a
 * heading per nested group — no panel, no banner of its own: the field's label already carries the
 * lock, and WHO writes the value is the field's `admin.description` behind its ⓘ. The look is
 * `admin.css` (`fc-sro`).
 */
export class StructuredReadOnlyField extends Reactor {
  @prop declare value?: unknown;
  @prop declare field?: any;
  /** Handed by the field renderer; the look follows the console's colour tokens instead. */
  @prop declare theme?: ThemeMode;

  @state private filterText = '';

  private get parsedValue(): unknown {
    return StructuredReadOnlyFieldService.parse(this.value);
  }

  private get rootNode() {
    return StructuredReadOnlyFieldService.classify(this.parsedValue);
  }

  /** Opens the editor the read value belongs to, offered from the ⋯ of every row of a table. */
  private get editRow(): (() => void) | undefined {
    const declared = this.field?.admin?.onEditRow;
    return typeof declared === 'function' ? declared as () => void : undefined;
  }

  /** What the plugin's dictionary calls its keys (`fields.<field>.keyLabels`), put on the field by the console's localizer. */
  private get keyLabels(): Record<string, string> | undefined {
    const named = this.field?.admin?.keyLabels;
    return named && typeof named === 'object' ? named as Record<string, string> : undefined;
  }

  @bound
  private handleFilterChange(next: string): void {
    this.filterText = next;
  }

  private renderBody(): ReactNode {
    const node = this.rootNode;
    if (node.kind === StructuredNodeKind.EMPTY) return <p className="fc-sro__absent">{AdminI18n.t('ui.structured.empty')}</p>;
    if (node.kind === StructuredNodeKind.ARRAY_TABLE) {
      // The search belongs to the TABLE, beside its filter, not on a row of its own above it: a field
      // the width of the card standing over four rows reads as the section's own control.
      return (
        <StructuredReadOnlyTable
          node={node}
          keyLabels={this.keyLabels}
          searchLower={String(this.field?.admin?.searchText ?? '').trim().toLowerCase()}
          editRow={this.editRow}
        />
      );
    }
    if (StructuredReadOnlyFieldService.isValueList(node)) return <StructuredReadOnlyList node={node} />;
    if (node.kind === StructuredNodeKind.SCALAR) {
      return <dl className="fc-sro__rows"><StructuredReadOnlyBlock label={AdminI18n.t('collection.structuredValue')} node={node} keyLabels={this.keyLabels} /></dl>;
    }

    // A long record (an import's whole payload) gets a filter; a short one is read at a glance.
    const isLarge = StructuredReadOnlyFieldService.isLargePayload(node);
    const filter = isLarge ? this.filterText.trim().toLowerCase() : '';
    /**
     * Past a few dozen values a recorded field is no longer read, it is searched. A product's
     * storefront snapshot printed 284 of them — the record a second time, with every translation key
     * and every metadata list under it — and made the product page 19 695px tall, three quarters of it
     * that one field. So this level's own values are drawn, what nests under them is counted, and the
     * filter above reaches every one of them. Nothing is dropped and nothing is behind a disclosure:
     * the count says what is there and the filter is how it is read.
     */
    const oversized = StructuredReadOnlyFieldService.isOversized(node) && !filter;
    const hidden = oversized ? StructuredReadOnlyFieldService.leafCount(node) - StructuredReadOnlyFieldService.ownLeafCount(node) : 0;
    return (
      <>
        {isLarge ? (
          <Input
            value={this.filterText}
            onChange={(event: any) => this.handleFilterChange(event?.target?.value ?? '')}
            placeholder={AdminI18n.t('ui.structured.filter')}
            className="fc-sro__filter"
          />
        ) : null}
        <StructuredReadOnlyGroup node={node} depth={1} filterLower={filter} keyLabels={this.keyLabels} leavesOnly={oversized} />
        {hidden > 0 ? <p className="fc-sro__more">{AdminI18n.t('ui.structured.more', { count: hidden })}</p> : null}
      </>
    );
  }

  render(): ReactNode {
    return <div className="fc-sro">{this.renderBody()}</div>;
  }
}
