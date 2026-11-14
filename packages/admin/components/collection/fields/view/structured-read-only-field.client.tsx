import { StructuredNodeKind } from '@/components/collection/fields/enums/structured-node-kind.enum';
import { ThemeMode } from '@fromcode119/core/client';
import type { ReactNode } from 'react';
import { Reactor, prop, state, bound } from '@fromcode119/react-class-components';
import { Input } from '@/components/ui/view/input.client';
import { StructuredReadOnlyBlock } from '@/components/collection/fields/view/structured-read-only-block.client';
import { StructuredReadOnlyGroup } from '@/components/collection/fields/view/structured-read-only-group.client';
import { StructuredReadOnlyTable } from '@/components/collection/fields/view/structured-read-only-table.client';
import { StructuredReadOnlyList } from '@/components/collection/fields/view/structured-read-only-list.client';
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

  /** The plugin names its own keys; the framework renders whatever it is told. */
  private get keyLabels(): Record<string, string> | undefined {
    const declared = this.field?.admin?.keyLabels;
    return declared && typeof declared === 'object' ? declared as Record<string, string> : undefined;
  }

  @bound
  private handleFilterChange(next: string): void {
    this.filterText = next;
  }

  private renderBody(): ReactNode {
    const node = this.rootNode;
    if (node.kind === StructuredNodeKind.EMPTY) return <p className="fc-sro__absent">{AdminI18n.t('ui.structured.empty')}</p>;
    if (node.kind === StructuredNodeKind.ARRAY_TABLE) return <StructuredReadOnlyTable node={node} keyLabels={this.keyLabels} />;
    if (StructuredReadOnlyFieldService.isValueList(node)) return <StructuredReadOnlyList node={node} />;
    if (node.kind === StructuredNodeKind.SCALAR) {
      return <dl className="fc-sro__rows"><StructuredReadOnlyBlock label={AdminI18n.t('collection.structuredValue')} node={node} keyLabels={this.keyLabels} /></dl>;
    }

    // A long record (an import's whole payload) gets a filter; a short one is read at a glance.
    const isLarge = StructuredReadOnlyFieldService.isLargePayload(node);
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
        <StructuredReadOnlyGroup node={node} depth={1} filterLower={isLarge ? this.filterText.trim().toLowerCase() : ''} keyLabels={this.keyLabels} />
      </>
    );
  }

  render(): ReactNode {
    return <div className="fc-sro">{this.renderBody()}</div>;
  }
}
