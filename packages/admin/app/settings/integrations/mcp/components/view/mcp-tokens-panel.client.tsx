import type { ReactNode } from 'react';
import { state } from '@fromcode119/reactor';
import { AdminApi } from '@/lib/api';
import { AdminComponent } from '@/components/view/admin-component.client';
import { Card } from '@/components/ui/view/card.client';
import { Badge } from '@/components/ui/view/badge.client';
import { Button } from '@/components/ui/view/button.client';
import { Loader } from '@/components/ui/view/loader.client';
import { ConfirmDialog } from '@/components/ui/view/confirm-dialog.client';
import { McpTokenCreateForm } from '@/app/settings/integrations/mcp/components/view/mcp-token-create-form.client';
import { McpTokensTable } from '@/app/settings/integrations/mcp/components/view/mcp-tokens-table.client';
import { PlatformAccess } from '@/lib/tenants/platform-access';
import { ButtonVariant } from '@/components/ui/enums/button-variant.enum';
import { BadgeVariant } from '@/components/ui/enums/badge-variant.enum';
import { FieldSize } from '@/components/ui/enums/field-size.enum';
import { NotificationType } from '@/components/enums/notification-type.enum';
import type { IMcpToken } from '@/app/settings/integrations/mcp/interfaces/mcp-token.interface';

/**
 * MCP access tokens — create, inspect and revoke.
 *
 * Built from the same primitives as the rest of Settings (`CompactPageHeader`, `Card`, `Input`,
 * `Button`, `Badge`, `ConfirmDialog`) rather than raw markup, so it inherits theme, spacing and dark
 * mode instead of re-stating them and drifting.
 *
 * The scope choices come from the LIVE tool list, never a hardcoded array: a fixed list drifts the
 * moment a plugin registers a tool pack, and would offer scopes that grant nothing.
 *
 * A created key is shown ONCE, held only until dismissed. The API stores a SHA-256 hash and cannot
 * return it again.
 *
 * A token is bound to the SITE this session is in. The platform admin may instead issue one for all
 * sites — that token then names its site per request (`sites.select` in the MCP server). A site admin
 * never sees that choice, and never sees another site's tokens.
 */
export class McpTokensPanel extends AdminComponent {
  @state loading = true;
  @state saving = false;
  @state tokens: IMcpToken[] = [];
  @state toolNames: string[] = [];
  @state newKey: string | null = null;
  @state revokeCandidate: IMcpToken | null = null;
  @state currentSite: string | null = null;
  @state multiTenant = false;
  @state platformAdmin = false;

  private mounted = false;

  async componentDidMount(): Promise<void> {
    this.mounted = true;
    await this.load();
  }

  componentWillUnmount(): void {
    this.mounted = false;
  }

  private async load(): Promise<void> {
    this.loading = true;
    try {
      const [tokenResponse, toolResponse] = await Promise.all([
        AdminApi.get('/mcp/tokens'),
        AdminApi.get('/mcp/scopes').catch(() => null),
      ]);
      if (!this.mounted) return;
      this.tokens = Array.isArray(tokenResponse?.tokens) ? tokenResponse.tokens : [];
      this.currentSite = tokenResponse?.site ?? null;
      this.multiTenant = tokenResponse?.multiTenant === true;
      this.platformAdmin = tokenResponse?.platformAdmin === true && PlatformAccess.canManagePlatform(this.auth.user);
      // `/mcp/scopes` is the session-readable companion to `/mcp/tools` (which is token-only, so an
      // admin session cannot read it). It returns tool NAMES only — enough to build the picker.
      const tools = Array.isArray(toolResponse?.tools) ? toolResponse.tools : [];
      this.toolNames = tools.map((t: any) => String(t || '')).filter(Boolean);
    } catch (error: any) {
      this.notifyError('Failed to load MCP tokens', error);
    } finally {
      if (this.mounted) this.loading = false;
    }
  }

  private notifyError(title: string, error: any): void {
    this.runtime.notify.addNotification({
      type: NotificationType.ERROR,
      title,
      message: error?.message || 'Unexpected error.',
    });
  }

  private async created(rawKey: string): Promise<void> {
    this.newKey = rawKey;
    await this.load();
  }

  private async revokeToken(): Promise<void> {
    const target = this.revokeCandidate;
    if (!target) return;
    try {
      await AdminApi.delete(`/mcp/tokens/${target.tokenId}`);
      this.revokeCandidate = null;
      await this.load();
    } catch (error: any) {
      this.notifyError('Failed to revoke token', error);
    }
  }

  /** Section shell matching Settings → Integrations: a Card with a bold title and a slate subtitle. */
  private section(title: string, subtitle: string, children: ReactNode): ReactNode {
    return (
      <Card className="p-5">
        <div className="mb-4">
          <h2 className="text-base font-bold tracking-tight text-slate-900 dark:text-white">{title}</h2>
          <p className="text-sm text-slate-500 mt-1">{subtitle}</p>
        </div>
        {children}
      </Card>
    );
  }

  private renderNewKey(): ReactNode {
    if (!this.newKey) return null;
    return (
      <Card className="p-5 border-amber-300 dark:border-amber-500/40">
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <Badge variant={BadgeVariant.WARNING}>Shown once</Badge>
            <span className="text-sm font-semibold text-slate-900 dark:text-white">
              Copy this key now — it cannot be shown again.
            </span>
          </div>
          <code className="block break-all rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 font-mono text-xs text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200">
            {this.newKey}
          </code>
          <div>
            <Button variant={ButtonVariant.SECONDARY} size={FieldSize.SM} onClick={() => { this.newKey = null; }}>
              Done
            </Button>
          </div>
        </div>
      </Card>
    );
  }

  private renderTokens(): ReactNode {
    return this.section(
      'Existing tokens',
      this.multiTenant && !this.platformAdmin ? 'Tokens for this site. Revoking one takes effect immediately.' : 'Every token issued for this installation. Revoking one takes effect immediately.',
      <McpTokensTable tokens={this.tokens} multiTenant={this.multiTenant} onRevoke={(token: IMcpToken) => { this.revokeCandidate = token; }} />,
    );
  }

  render(): ReactNode {
    if (this.loading) return <Loader />;

    return (
      <>
        {this.renderNewKey()}
        <McpTokenCreateForm
          toolNames={this.toolNames}
          tokens={this.tokens}
          multiTenant={this.multiTenant}
          platformAdmin={this.platformAdmin}
          currentSite={this.currentSite}
          onCreated={(rawKey: string) => this.created(rawKey)}
        />
        {this.renderTokens()}

        <ConfirmDialog
          isOpen={!!this.revokeCandidate}
          onClose={() => { this.revokeCandidate = null; }}
          onConfirm={() => this.revokeToken()}
          title="Revoke this token?"
          description={`"${this.revokeCandidate?.label || ''}" stops working immediately, and any client using it loses access. This cannot be undone.`}
          confirmLabel="Revoke"
          variant={ButtonVariant.DANGER}
        />
      </>
    );
  }
}
