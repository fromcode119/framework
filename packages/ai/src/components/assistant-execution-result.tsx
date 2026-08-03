import { ExecutionKind } from '@ai/enums/assistant-execution-kind.enum';
import type { ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/reactor';
import { AssistantFormatUtils } from '@ai/assistant-format-utils';
import { AssistantPreviewUtils } from '@ai/assistant-preview-utils';
import { AssistantSurfaceUtils } from '@ai/assistant-surface-utils';

export class AssistantExecutionResult extends PureReactor {
  @prop declare item: unknown;
  @prop declare resultIndex: number;

  private get output(): Record<string, unknown> | null {
    const item = this.item;
    return item && typeof item === 'object' && (item as { output?: unknown }).output && typeof (item as { output?: unknown }).output === 'object'
      ? ((item as { output: Record<string, unknown> }).output)
      : null;
  }

  private get changedFields(): any[] {
    const output = this.output;
    return Array.isArray(output?.changedFields) ? (output!.changedFields as any[]) : [];
  }

  private get before(): unknown {
    const output = this.output;
    return output && typeof output.before === 'object' ? output.before : null;
  }

  private get after(): unknown {
    const output = this.output;
    return output && typeof output.after === 'object' ? output.after : null;
  }

  private get kind(): ExecutionKind {
    return AssistantSurfaceUtils.resolveExecutionKind(this.item);
  }

  private get resultClass(): string {
    return this.kind === ExecutionKind.FAILED
      ? 'border-rose-300/70 bg-rose-50/90 dark:border-rose-300/35 dark:bg-rose-300/10'
      : this.kind === ExecutionKind.SKIPPED
        ? 'border-slate-300/80 bg-slate-100/75 dark:border-slate-700 dark:bg-slate-900/45'
        : 'border-emerald-300/70 bg-emerald-50/90 dark:border-emerald-300/35 dark:bg-emerald-300/10';
  }

  private renderChangedField(change: any, changeIndex: number): ReactNode {
    return (
      <div key={`change-${this.resultIndex}-${changeIndex}`} className="rounded-md border border-slate-200 bg-slate-50/85 p-1.5 dark:border-slate-700 dark:bg-slate-900/65">
        <p className="text-[10px] font-semibold text-slate-700 dark:text-slate-200">{String(change?.field || '')}</p>
        <div className="mt-1 grid gap-1.5 sm:grid-cols-2">
          <div>
            <p className="text-[9px] uppercase tracking-wide text-slate-500 dark:text-slate-400">Before</p>
            <p className="whitespace-pre-wrap break-words text-[10px] text-slate-700 dark:text-slate-200">{AssistantFormatUtils.formatPreviewValue(change?.before)}</p>
          </div>
          <div>
            <p className="text-[9px] uppercase tracking-wide text-slate-500 dark:text-slate-400">After</p>
            <p className="whitespace-pre-wrap break-words text-[10px] font-medium text-slate-800 dark:text-slate-100">{AssistantFormatUtils.formatPreviewValue(change?.after)}</p>
          </div>
        </div>
      </div>
    );
  }

  private renderChangedFields(): ReactNode {
    const changedFields = this.changedFields;
    if (changedFields.length === 0) {
      return null;
    }
    return (
      <div className="mt-2 space-y-1.5 rounded-lg border border-slate-200 bg-white/80 p-2 dark:border-slate-700 dark:bg-slate-950/55">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Changed fields</p>
        {changedFields.map((change: any, changeIndex: number) => this.renderChangedField(change, changeIndex))}
      </div>
    );
  }

  private renderRawBeforeAfter(): ReactNode {
    const before = this.before;
    const after = this.after;
    if (!(before || after) || this.changedFields.length !== 0) {
      return null;
    }
    return (
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        <div className="rounded-lg border border-slate-200 bg-white/80 p-2 dark:border-slate-700 dark:bg-slate-950/55"><p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Before</p><pre className="max-h-36 overflow-auto text-[10px] text-slate-700 dark:text-slate-200"><code>{JSON.stringify(before || {}, null, 2)}</code></pre></div>
        <div className="rounded-lg border border-slate-200 bg-white/80 p-2 dark:border-slate-700 dark:bg-slate-950/55"><p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">After</p><pre className="max-h-36 overflow-auto text-[10px] text-slate-700 dark:text-slate-200"><code>{JSON.stringify(after || {}, null, 2)}</code></pre></div>
      </div>
    );
  }

  private renderVisualCheck(): ReactNode {
    const paths = AssistantPreviewUtils.resolveExecutionPreviewPaths(this.item);
    const beforeUrl = AssistantPreviewUtils.toAbsolutePreviewUrl(paths.beforePath);
    const afterUrl = AssistantPreviewUtils.toAbsolutePreviewUrl(paths.afterPath);
    const currentUrl = AssistantPreviewUtils.toAbsolutePreviewUrl(paths.currentPath);
    if (!currentUrl) {
      return null;
    }
    return (
      <details className="mt-2 rounded-lg border border-slate-200 bg-white/80 p-2 dark:border-slate-700 dark:bg-slate-950/55">
        <summary className="cursor-pointer text-[10px] font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">Visual check</summary>
        <div className="mt-2 space-y-2">
          <div className="flex flex-wrap gap-1.5">
            {beforeUrl ? <a href={beforeUrl} target="_blank" rel="noreferrer" className="rounded-md border border-slate-300 bg-slate-100 px-2 py-1 text-[10px] font-semibold text-slate-700 transition hover:bg-slate-200 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700">Open before path</a> : null}
            {afterUrl ? <a href={afterUrl} target="_blank" rel="noreferrer" className="rounded-md border border-slate-300 bg-slate-100 px-2 py-1 text-[10px] font-semibold text-slate-700 transition hover:bg-slate-200 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700">Open after path</a> : <a href={currentUrl} target="_blank" rel="noreferrer" className="rounded-md border border-slate-300 bg-slate-100 px-2 py-1 text-[10px] font-semibold text-slate-700 transition hover:bg-slate-200 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700">Open affected page</a>}
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {beforeUrl ? <div className="overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-950"><p className="border-b border-slate-200 px-2 py-1 text-[9px] uppercase tracking-wide text-slate-500 dark:border-slate-700 dark:text-slate-400">Before path</p><iframe title={`before-preview-${this.resultIndex}`} src={beforeUrl} className="h-44 w-full bg-white" /></div> : null}
            <div className="overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-950"><p className="border-b border-slate-200 px-2 py-1 text-[9px] uppercase tracking-wide text-slate-500 dark:border-slate-700 dark:text-slate-400">{afterUrl ? 'After path' : 'Current page'}</p><iframe title={`after-preview-${this.resultIndex}`} src={afterUrl || currentUrl} className="h-44 w-full bg-white" /></div>
          </div>
        </div>
      </details>
    );
  }

  render(): ReactNode {
    const kind = this.kind;
    const title = AssistantFormatUtils.formatExecutionTitle(this.item);
    const detail = AssistantFormatUtils.formatExecutionDetail(this.item);
    const surface = AssistantSurfaceUtils.resolveExecutionSurface(this.item);

    return (
      <details className={`rounded-lg border p-2 ${this.resultClass}`} open={kind === ExecutionKind.FAILED}>
        <summary className="cursor-pointer list-none">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-semibold text-slate-800 dark:text-slate-100">{title}</span>
            <span className={`rounded-full border px-1.5 py-0.5 text-[9px] uppercase tracking-wide ${surface.badgeClass}`}>{surface.label}</span>
          </div>
        </summary>
        {detail ? <p className="mt-2 text-[11px] text-slate-600 dark:text-slate-300">{detail}</p> : null}
        {this.renderChangedFields()}
        {this.renderRawBeforeAfter()}
        {this.renderVisualCheck()}
      </details>
    );
  }
}
