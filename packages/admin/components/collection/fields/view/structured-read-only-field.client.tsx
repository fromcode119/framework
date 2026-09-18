import { StructuredNodeKind } from '@/components/collection/fields/enums/structured-node-kind.enum';
import { ThemeMode } from '@fromcode119/core/client';
import type { ReactNode } from 'react';
import { Reactor, prop, state, bound } from '@fromcode119/react-class-components';
import { FrameworkIcons } from '@fromcode119/react';
import { Input } from '@/components/ui/view/input.client';
import { StructuredReadOnlyRow } from '@/components/collection/fields/view/structured-read-only-row.client';
import { StructuredReadOnlyTable } from '@/components/collection/fields/view/structured-read-only-table.client';
import { StructuredReadOnlyFieldService } from '@/components/collection/fields/structured-read-only-field-service';

/**
 * Framework-owned, read-only renderer for structured/JSON field values — the legible replacement for
 * the raw JSON textarea. Any plugin field sets `admin.component: 'StructuredReadOnlyField'` (the
 * field's OWN `admin.readOnly`/runtime writes the value; this component never calls `onChange`). It
 * never invents provenance: the header is exactly `field.admin.description`, or, if the plugin left
 * it blank, a neutral "recorded automatically" line. Registered at admin bootstrap.
 */
export class StructuredReadOnlyField extends Reactor {
  @prop declare value?: unknown;
  @prop declare field?: any;
  @prop declare theme?: ThemeMode;

  @state private filterText = '';
  @state private copied = false;

  private get parsedValue(): unknown {
    return StructuredReadOnlyFieldService.parse(this.value);
  }

  private get rootNode() {
    return StructuredReadOnlyFieldService.classify(this.parsedValue);
  }

  @bound
  private handleFilterChange(next: string): void {
    this.filterText = next;
  }

  @bound
  private async handleCopy(): Promise<void> {
    try {
      await navigator.clipboard.writeText(JSON.stringify(this.parsedValue, null, 2));
      this.copied = true;
      setTimeout(() => { this.copied = false; }, 1500);
    } catch (error) {
      console.error('[StructuredReadOnlyField] Failed to copy to clipboard:', error);
    }
  }

  /**
   * States the one fact this control carries: the value is written by the runtime, not here. WHO
   * writes it belongs in `admin.description`, which the field renderer already prints below every
   * field — repeating it here would show the same sentence twice on the same screen.
   */
  private renderProvenance(isDark: boolean): ReactNode {
    return (
      <div className={`flex items-start gap-2 rounded-lg border px-3 py-2 ${isDark ? 'border-slate-800 bg-slate-950/40' : 'border-slate-200 bg-slate-50'}`}>
        <FrameworkIcons.Lock size={12} className={`mt-0.5 shrink-0 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
        <p className={`text-[11px] font-medium leading-relaxed ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
          Recorded automatically — not editable here.
        </p>
      </div>
    );
  }

  private renderBody(isDark: boolean): ReactNode {
    const node = this.rootNode;
    const isLarge = StructuredReadOnlyFieldService.isLargePayload(node);
    const filterLower = isLarge ? this.filterText.trim().toLowerCase() : '';

    if (node.kind === StructuredNodeKind.EMPTY) {
      return <p className={`text-[12px] font-medium ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Nothing recorded yet.</p>;
    }

    if (node.kind === StructuredNodeKind.ARRAY_TABLE) {
      return <StructuredReadOnlyTable node={node} isDark={isDark} />;
    }

    if (node.kind === StructuredNodeKind.SCALAR) {
      return <StructuredReadOnlyRow label="value" node={node} depth={1} isDark={isDark} filterLower={filterLower} />;
    }

    const rows = node.kind === StructuredNodeKind.OBJECT
      ? (node.entries ?? []).map((entry) => (
        <StructuredReadOnlyRow key={entry.key} label={entry.key} node={entry.node} depth={1} defaultCollapsed={isLarge} isDark={isDark} filterLower={filterLower} />
      ))
      : (node.items ?? []).map((item, index) => (
        <StructuredReadOnlyRow key={index} label={`[${index}]`} node={item} depth={1} defaultCollapsed={isLarge} isDark={isDark} filterLower={filterLower} />
      ));

    return (
      <>
        {isLarge ? (
          <Input
            value={this.filterText}
            onChange={(event: any) => this.handleFilterChange(event?.target?.value ?? '')}
            placeholder="Filter by key…"
            className="mb-2"
          />
        ) : null}
        <div>{rows}</div>
      </>
    );
  }

  render(): ReactNode {
    const theme = this.theme ?? ThemeMode.LIGHT;
    const isDark = theme === ThemeMode.DARK;
    const node = this.rootNode;

    return (
      <div className="space-y-2">
        {this.renderProvenance(isDark)}
        {this.renderBody(isDark)}
        {node.kind !== StructuredNodeKind.EMPTY ? (
          <button
            type="button"
            onClick={this.handleCopy}
            className={`text-[11px] font-bold underline underline-offset-2 ${isDark ? 'text-slate-400 hover:text-slate-200' : 'text-slate-500 hover:text-slate-700'}`}
          >
            {this.copied ? 'Copied!' : 'Copy as JSON'}
          </button>
        ) : null}
      </div>
    );
  }
}
