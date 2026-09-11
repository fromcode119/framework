import type { ReactNode } from 'react';
import { PluginComponent, prop } from '@fromcode119/sdk/react';

/**
 * What changed in the version this source last built.
 *
 * The commit subjects between the previously built revision and this one — written by the people who
 * made the changes. Without them a row says "v0.1.5" and nothing else, which asks an operator to
 * accept a number, and offers no way to tell a typo fix from a schema change.
 *
 * Nothing is shown when there is nothing to show. A first build has no previous revision to compare
 * against, and "initial release" would be a sentence this code invented about someone else's work.
 */
export class BuildChangelog extends PluginComponent {
  declare props: { changelog?: string; version?: string };
  @prop changelog?: string;
  @prop version?: string;

  /** A long history collapses: the point is what changed, not a scrolling log inside a list row. */
  private static readonly VISIBLE = 5;

  private get lines(): string[] {
    return String(this.changelog || '')
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line !== '');
  }

  render(): ReactNode {
    const lines = this.lines;
    if (lines.length === 0) return null;

    const shown = lines.slice(0, BuildChangelog.VISIBLE);
    const remaining = lines.length - shown.length;

    return (
      <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-800 dark:bg-slate-900/60">
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">
          {this.version ? `What changed in v${this.version}` : 'What changed'}
        </p>
        <ul className="mt-1 space-y-0.5">
          {shown.map((line) => (
            <li key={line} className="text-xs leading-relaxed text-slate-600 dark:text-slate-300">
              {line}
            </li>
          ))}
        </ul>
        {remaining > 0 ? (
          <p className="mt-1 text-[11px] text-slate-400">and {remaining} more</p>
        ) : null}
      </div>
    );
  }
}
