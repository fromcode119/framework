import type { ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/react-class-components';
import { CheckCircle, Info } from 'lucide-react';
import { AdminI18n } from '@/lib/i18n/admin-i18n';
import { Spinner } from '@/components/ui/view/spinner.client';

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
    if (this.reading) return <Spinner className="fc-spinner--muted" />;
    if (this.detected) return <CheckCircle size={16} className="fc-tone-success" />;
    return <Info size={16} className="fc-tone-muted" />;
  }

  render(): ReactNode {
    return (
      <div className="flex items-start gap-3 rounded-xl border fc-tone-line fc-tone-raised px-3 py-2.5">
        <span className="mt-0.5 shrink-0">{this.icon}</span>
        {this.detected ? (
          <div className="min-w-0">
            <p className="text-sm font-medium fc-tone-text">
              {this.slug}
              <span className="ms-2 text-xs font-medium fc-tone-muted">{this.kind} · {this.vendor}</span>
            </p>
            <p className="text-xs fc-tone-muted">{AdminI18n.t('sources.readFromTheManifest')}</p>
          </div>
        ) : (
          <p className="text-xs leading-5 fc-tone-muted">{this.message}</p>
        )}
      </div>
    );
  }
}
