import { StructuredNodeKind } from '@/components/collection/fields/enums/structured-node-kind.enum';
import { ThemeMode } from '@fromcode119/core/client';
import type { ReactNode } from 'react';
import { Reactor, prop, state, bound } from '@fromcode119/react-class-components';
import { FrameworkIcons } from '@fromcode119/react';
import { Input } from '@/components/ui/view/input.client';
import { StructuredReadOnlyBlock } from '@/components/collection/fields/view/structured-read-only-block.client';
import { StructuredReadOnlyGroup } from '@/components/collection/fields/view/structured-read-only-group.client';
import { StructuredReadOnlyTable } from '@/components/collection/fields/view/structured-read-only-table.client';
import { StructuredReadOnlyFieldService } from '@/components/collection/fields/structured-read-only-field-service';

/**
 * Framework-owned, read-only renderer for structured/JSON field values — the legible replacement for
 * the raw JSON textarea. Any plugin field sets `admin.component: 'StructuredReadOnlyField'` (the
 * field's OWN `admin.readOnly`/runtime writes the value; this component never calls `onChange`).
 * Registered at admin bootstrap.
 *
 * ## Why this looks like a panel and not like the rest of the form
 *
 * It used to render as bare rows directly in the section card, which was legible but gave the
 * operator nothing to tell it apart from the editable fields beside it — the values simply read as a
 * form nobody had filled in. Three cues carry "recorded, not editable" together, and removing any one
 * of them was what made the previous pass unreadable as read-only:
 *
 *  - a RECESSED surface (`bg-slate-50`), the inverse of the white boxes you can type into;
 *  - a white bar across the top that SAYS it, with the lock, rather than implying it by colour;
 *  - values one weight lighter than an editable input's text.
 *
 * One frame, not three: the field wrapper no longer draws a box of its own
 * (`FieldRendererUtils.wrapperClassName`), so this surface is the only outline around the value.
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

  /** The plugin names its own keys; the framework renders whatever it is told. */
  private get keyLabels(): Record<string, string> | undefined {
    const declared = this.field?.admin?.keyLabels;
    return declared && typeof declared === 'object' ? declared as Record<string, string> : undefined;
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
   * The bar states the one fact this control carries: the value is written by the runtime, not here.
   * WHO writes it belongs in `admin.description`, which the field renderer already prints below every
   * field — repeating it here would show the same sentence twice on the same screen.
   */
  private renderBar(isDark: boolean, showCopy: boolean): ReactNode {
    const barClass = isDark
      ? 'border-slate-700 bg-slate-900'
      : 'border-slate-200 bg-white';
    const buttonClass = isDark
      ? 'border-slate-700 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
      : 'border-slate-200 text-slate-500 hover:bg-slate-100 hover:text-slate-700';

    return (
      <div className={`flex items-center gap-2 border-b px-3 py-2 ${barClass}`}>
        <FrameworkIcons.Lock size={12} className={`shrink-0 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
        <p className={`flex-1 text-[10.5px] font-semibold leading-relaxed ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
          Recorded automatically — not editable here.
        </p>
        {showCopy ? (
          <button
            type="button"
            onClick={this.handleCopy}
            className={`shrink-0 inline-flex h-[22px] items-center gap-1 rounded-lg border px-2 text-[9px] font-semibold tracking-wide transition-colors ${buttonClass}`}
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
      return <StructuredReadOnlyTable node={node} isDark={isDark} keyLabels={this.keyLabels} />;
    }

    if (node.kind === StructuredNodeKind.SCALAR) {
      return <StructuredReadOnlyBlock label="value" node={node} isDark={isDark} keyLabels={this.keyLabels} />;
    }

    return (
      <>
        {isLarge ? (
          <Input
            value={this.filterText}
            onChange={(event: any) => this.handleFilterChange(event?.target?.value ?? '')}
            placeholder="Filter by key…"
            className="mb-3"
          />
        ) : null}
        <StructuredReadOnlyGroup node={node} depth={1} isDark={isDark} filterLower={filterLower} keyLabels={this.keyLabels} />
      </>
    );
  }

  render(): ReactNode {
    const theme = this.theme ?? ThemeMode.LIGHT;
    const isDark = theme === ThemeMode.DARK;
    const node = this.rootNode;
    const surfaceClass = isDark
      ? 'border-slate-700 bg-slate-950/40'
      : 'border-slate-200 bg-slate-50';

    return (
      <div className={`overflow-hidden rounded-xl border ${surfaceClass}`}>
        {this.renderBar(isDark, node.kind !== StructuredNodeKind.EMPTY)}
        <div className="px-3.5 py-3.5">{this.renderBody(isDark)}</div>
      </div>
    );
  }
}
