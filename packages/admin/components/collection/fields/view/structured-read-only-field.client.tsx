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
  private renderProvenance(isDark: boolean, showCopy: boolean): ReactNode {
    return (
      <div className={`flex items-center gap-2 rounded-lg border px-3 py-2 ${isDark ? 'border-slate-800 bg-slate-950/40' : 'border-slate-200 bg-slate-50'}`}>
        <FrameworkIcons.Lock size={12} className={`shrink-0 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
        <p className={`flex-1 text-[11px] font-medium leading-relaxed ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
          Recorded automatically — not editable here.
        </p>
        {showCopy ? (
          // Beside the line that explains the control, not stranded under the data as a bare
          // underlined link, which read like a developer affordance rather than an admin action.
          <button
            type="button"
            onClick={this.handleCopy}
            className={`shrink-0 inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[10px] font-bold transition-colors ${isDark ? 'border-slate-700 text-slate-400 hover:bg-slate-800 hover:text-slate-200' : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-100 hover:text-slate-700'}`}
          >
            <FrameworkIcons.Copy size={11} />
            {this.copied ? 'Copied' : 'Copy JSON'}
          </button>
        ) : null}
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
        {/* The rows sit in a surface of their own. Loose rows separated only by hairlines read as
            output pasted into the page — the table node beside them has always had a container, so
            the two halves of the same control did not look like the same control. */}
        <div className={`overflow-hidden rounded-lg border ${isDark ? 'border-slate-800 bg-slate-950/20' : 'border-slate-200 bg-white'}`}>{rows}</div>
      </>
    );
  }

  render(): ReactNode {
    const theme = this.theme ?? ThemeMode.LIGHT;
    const isDark = theme === ThemeMode.DARK;
    const node = this.rootNode;

    return (
      <div className="space-y-2">
        {this.renderProvenance(isDark, node.kind !== StructuredNodeKind.EMPTY)}
        {this.renderBody(isDark)}
      </div>
    );
  }
}
