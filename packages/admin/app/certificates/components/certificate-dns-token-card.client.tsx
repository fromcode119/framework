import type { ChangeEvent, ReactNode } from 'react';
import { bound, state } from '@fromcode119/react-class-components';
import { ThemeMode } from '@fromcode119/core/client';
import { AdminComponent } from '@/components/view/admin-component.client';
import { Button } from '@/components/ui/view/button.client';
import { ButtonVariant } from '@/components/ui/enums/button-variant.enum';
import { Card } from '@/components/ui/view/card.client';
import { FrameworkIcons } from '@fromcode119/react';
import { Input } from '@/components/ui/view/input.client';
import { CertificatesClient } from '@/lib/certificates/certificates-client';

/**
 * This SITE's own Cloudflare API token, for DNS-01 and wildcard orders.
 *
 * It exists because a customer's domain lives in the CUSTOMER's Cloudflare account. Proving control
 * of a zone over DNS-01 means writing into it, so the credential has to be theirs — a single
 * platform-wide token would mean either holding DNS-write on every customer's zones, or offering
 * "Automatic (wildcard)" on a host it can never obtain.
 *
 * WHERE THE VALUE COMES FROM IS STATED, always. A site with no token of its own falls back to the
 * platform's, and that is said out loud rather than shown as a blank field that looks unconfigured
 * — an inherited value the operator cannot see the source of is the one thing this admin may never
 * do. The token itself is never shown again once saved; only whether one exists, and whose.
 */
export class CertificateDnsTokenCard extends AdminComponent<{
  /** `automation` from the certificates read — carries the scope and whether a token resolved. */
  automation: Record<string, unknown> | null;
  /** Re-read the page after a change, so the resolved scope shown here stays true. */
  onChanged: () => Promise<void> | void;
}> {
  @state private tokenInput = '';
  @state private isSaving = false;
  @state private message = '';

  private get isConfigured(): boolean {
    return this.props.automation?.isCloudflareConfigured === true;
  }

  /** True when this site has none of its own and is using the platform's. */
  private get isInherited(): boolean {
    return this.props.automation?.isCloudflareTokenInherited === true;
  }

  /** True only when the site stores its own — the one case where Clear means anything here. */
  private get hasOwnToken(): boolean {
    return this.isConfigured && !this.isInherited;
  }

  @bound private onToken(event: ChangeEvent<HTMLInputElement>): void {
    this.tokenInput = event.target.value;
  }

  /**
   * Saves whatever is typed. A BLANK FIELD IS A NO-OP — leaving it empty and pressing Save must
   * keep the currently saved token, never clear it as a side effect. Clearing is what the explicit
   * Clear button is for, and the two must not be reachable by the same gesture.
   */
  @bound private async save(): Promise<void> {
    const token = this.tokenInput.trim();
    if (!token) {
      this.message = 'Nothing to save — paste a token, or use Clear to remove the saved one.';
      return;
    }
    await this.write(token, 'Saved. This site now uses its own Cloudflare token.');
  }

  @bound private async clear(): Promise<void> {
    await this.write('', "Removed. This site falls back to the platform's token.");
  }

  private async write(token: string, success: string): Promise<void> {
    this.isSaving = true;
    try {
      await CertificatesClient.setCloudflareToken(token);
      this.tokenInput = '';
      this.message = success;
      await this.props.onChanged();
    } catch (error: any) {
      this.message = String(error?.message || 'Could not save the token.');
    } finally {
      this.isSaving = false;
    }
  }

  /** What is in use right now, named. Never a blank that could be read as "nothing configured". */
  private get provenance(): string {
    if (this.hasOwnToken) return 'This site uses its own Cloudflare token.';
    if (this.isInherited) {
      return "This site has no token of its own and is using the platform's. That token can only "
        + "order certificates for zones it has access to — if this site's domain is in a different "
        + 'Cloudflare account, save this site\'s own token here.';
    }
    return 'No Cloudflare token applies to this site, so DNS-01 and wildcard orders are unavailable here.';
  }

  render(): ReactNode {
    const dark = this.theme === ThemeMode.DARK;
    const label = `block text-xs font-semibold mb-1 ${dark ? 'text-slate-300' : 'text-slate-700'}`;

    return (
      <Card title="Cloudflare API token">
        <p className={`text-sm mb-3 ${dark ? 'text-slate-400' : 'text-slate-500'}`}>
          Needed to order a certificate proved through DNS — the wildcard (<code>*.example.com</code>)
          variant, and any domain behind a proxy or CDN. The token needs Zone → DNS → Edit on this
          site&rsquo;s zone; it is stored encrypted and is never shown again once saved.
        </p>

        <label className={label}>This site&rsquo;s token</label>
        <div className="flex items-center gap-2 max-w-md">
          <Input
            value={this.tokenInput}
            onChange={this.onToken}
            type="password"
            placeholder={this.hasOwnToken ? 'Saved — leave blank to keep, or use Clear to remove' : 'Paste a Cloudflare API token'}
          />
          <Button onClick={this.save} isLoading={this.isSaving} icon={<FrameworkIcons.Save size={14} />}>Save</Button>
          {this.hasOwnToken ? (
            <Button variant={ButtonVariant.GHOST} onClick={this.clear} isLoading={this.isSaving}>Clear</Button>
          ) : null}
        </div>

        <p className={`mt-2 text-[11px] ${dark ? 'text-slate-400' : 'text-slate-500'}`}>
          {this.message || this.provenance}
        </p>
      </Card>
    );
  }
}
