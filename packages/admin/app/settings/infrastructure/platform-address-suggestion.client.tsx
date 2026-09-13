import type { ReactNode } from 'react';
import { bound, prop } from '@fromcode119/react-class-components';
import { ThemeMode } from '@fromcode119/core/client';
import { AdminComponent } from '@/components/view/admin-component.client';
import { Button } from '@/components/ui/view/button.client';
import { ButtonVariant } from '@/components/ui/enums/button-variant.enum';
import { FieldSize } from '@/components/ui/enums/field-size.enum';

/**
 * What this platform's own hostnames currently resolve to, offered for the addresses field.
 *
 * A SUGGESTION WITH ITS SOURCE SHOWN, never a value that fills itself in. The hostname is printed
 * beside the answer because that is the provenance — the operator can see it came from a name they
 * configured, and can judge whether it is this machine or something sitting in front of it. No
 * detection can tell those two apart, which is exactly why a person accepts it rather than the
 * platform assuming it.
 *
 * IPv6 is listed but never included in the one-click fill. Declaring a v6 address the edge does not
 * actually listen on makes every customer's AAAA record fail validation — and that failure is at the
 * authority, where failures are rationed.
 */
export class PlatformAddressSuggestion extends AdminComponent {
  declare props: Pick<PlatformAddressSuggestion, 'candidates' | 'onUse'>;

  @prop declare candidates: Array<{ host: string; ipv4: string[]; ipv6: string[] }>;
  @prop declare onUse: (addresses: string) => void;

  /** The distinct IPv4 answers across every platform hostname. */
  private get addresses(): string[] {
    return [...new Set(this.candidates.flatMap((candidate) => candidate.ipv4))];
  }

  @bound private use(): void {
    this.onUse(this.addresses.join('\n'));
  }

  render(): ReactNode {
    if (!this.candidates.length || !this.addresses.length) return null;
    const dark = this.theme === ThemeMode.DARK;
    const muted = dark ? 'text-slate-500' : 'text-slate-400';

    return (
      <div className={`rounded-lg border px-3 py-2.5 mb-2 ${dark ? 'border-white/10 bg-slate-800/40' : 'border-slate-200 bg-slate-50'}`}>
        <p className={`text-[11px] font-semibold mb-1 ${dark ? 'text-slate-300' : 'text-slate-600'}`}>
          Resolved from this platform’s own hostnames, just now
        </p>
        {this.candidates.map((candidate) => (
          <p key={candidate.host} className={`text-[11px] font-mono leading-snug ${muted}`}>
            {candidate.host} → {candidate.ipv4.join(', ') || '—'}
            {candidate.ipv6.length ? ` · IPv6 ${candidate.ipv6.join(', ')}` : ''}
          </p>
        ))}
        <div className="mt-2 flex items-center justify-between gap-3">
          <p className={`text-[11px] leading-snug ${muted}`}>
            If those hostnames sit behind a proxy or CDN this is the proxy’s address, not this machine’s.
            Check before using it.
          </p>
          <Button variant={ButtonVariant.OUTLINE} size={FieldSize.SM} onClick={this.use}>
            Use {this.addresses.join(', ')}
          </Button>
        </div>
      </div>
    );
  }
}
