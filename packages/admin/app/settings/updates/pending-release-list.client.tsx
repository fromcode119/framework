import type { ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/react-class-components';

/**
 * Every version between this installation and the newest one, with what each changed.
 *
 * "Install v0.2.16" asked an operator to agree to a number. Being one release behind is a different
 * decision from being five, and the reason to take a release is in what it says it fixed.
 *
 * The text is the release commit's own message, rendered verbatim. A release whose commit said
 * nothing shows nothing — there is no generated summary and no stand-in sentence, because an invented
 * changelog is worse than an absent one: it is a claim about code that nobody made.
 */
export class PendingReleaseList extends PureReactor {
  @prop declare releases: Array<{ version: string; notes: string }>;

  render(): ReactNode {
    if (!this.releases?.length) return null;

    return (
      <div className="mt-4 space-y-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">
          {this.releases.length === 1 ? '1 release' : `${this.releases.length} releases`} since this one
        </p>
        <ol className="space-y-3">
          {this.releases.map((release) => (
            <li key={release.version} className="border-l-2 border-slate-200 pl-3 dark:border-slate-700">
              <p className="font-mono text-[12px] font-semibold text-slate-800 dark:text-slate-100">
                v{release.version}
              </p>
              {release.notes ? (
                <p className="mt-1 whitespace-pre-line text-[11.5px] leading-relaxed text-slate-600 dark:text-slate-300">
                  {release.notes}
                </p>
              ) : (
                <p className="mt-1 text-[11.5px] italic text-slate-400">No notes were written for this release.</p>
              )}
            </li>
          ))}
        </ol>
      </div>
    );
  }
}
