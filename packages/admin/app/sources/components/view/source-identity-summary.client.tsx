import type { ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/react-class-components';
import { CheckCircle, Loader2, Info } from 'lucide-react';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

/**
 * What the repository says it is — name, kind and vendor — read from its own manifest and shown as
 * one line to check, not as three disabled inputs that looked like fields waiting to be filled.
 * Before the repository answers, the line says what is happening instead of guessing.
 */
export class SourceIdentitySummary extends PureReactor {
  declare props: Pick<SourceIdentitySummary, 'detected' | 'slug' | 'kind' | 'vendor' | 'reading' | 'message'>;

  /** The repository was read and declared an extension; until then the line says what is happening. */
  @prop declare detected: boolean;
  @prop declare slug: string;
  @prop declare kind: string;
  @prop declare vendor: string;
  @prop declare reading: boolean;
  /** What to say while the repository has not been read, or why it could not be. */
  @prop declare message: string;

  private get icon(): ReactNode {
    if (this.reading) return <Loader2 size={16} className="animate-spin text-slate-400" />;
    if (this.detected) return <CheckCircle size={16} className="text-emerald-500" />;
    return <Info size={16} className="text-slate-400" />;
  }

  render(): ReactNode {
    return (
      <div className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 dark:border-slate-800 dark:bg-slate-900/60">
        <span className="mt-0.5 shrink-0">{this.icon}</span>
        {this.detected ? (
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-900 dark:text-white">
              {this.slug}
              <span className="ml-2 text-xs font-medium text-slate-500 dark:text-slate-400">{this.kind} · {this.vendor}</span>
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">{AdminI18n.t('sources.readFromTheManifest')}</p>
          </div>
        ) : (
          <p className="text-xs leading-5 text-slate-600 dark:text-slate-300">{this.message}</p>
        )}
      </div>
    );
  }
}
