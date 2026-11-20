import { FrameworkIcons } from '@fromcode119/react';
import { RecordCard } from '@/components/ui/view/record-card.client';
import { ListShell } from '@/components/ui/view/list-shell.client';
import { StateBadge } from '@/components/ui/view/state-badge.client';
import { CodeBlock } from '@/components/ui/view/code-block.client';
import type { ReactNode } from 'react';
import { state } from '@fromcode119/react-class-components';
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
import { AdminI18n } from '@/lib/i18n/admin-i18n';

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
  @state creating = false;
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
      this.notifyError(AdminI18n.t('settings.integrations.failedToLoadMcpTokens'), error);
    } finally {
      if (this.mounted) this.loading = false;
    }
  }

  private notifyError(title: string, error: any): void {
    this.runtime.notify.addNotification({
      type: NotificationType.ERROR,
      title,
      message: error?.message || AdminI18n.t('settings.integrations.unexpectedError'),
    });
  }

  private async created(rawKey: string): Promise<void> {
    this.creating = false;
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
      this.notifyError(AdminI18n.t('settings.integrations.failedToRevokeToken'), error);
    }
  }

  /** The key of a token just made: shown this once, with the way to copy it. */
  private renderNewKey(): ReactNode {
    if (!this.newKey) return null;
    return (
      <RecordCard title={AdminI18n.t('settings.integrations.copyThisKeyNowIt')} aside={<StateBadge tone="warning">{AdminI18n.t('settings.integrations.shownOnce')}</StateBadge>}>
        <div className="fc-form-stack">
          <CodeBlock code={this.newKey} />
          <div><Button variant={ButtonVariant.SECONDARY} onClick={() => { this.newKey = null; }}>{AdminI18n.t('settings.integrations.done')}</Button></div>
        </div>
      </RecordCard>
    );
  }

  private renderTokens(): ReactNode {
    return (
      <ListShell title={AdminI18n.t('settings.integrations.existingTokens')} count={this.tokens.length}
        subtitle={this.multiTenant && !this.platformAdmin ? AdminI18n.t('settings.integrations.tokensForThisSiteRevoking') : AdminI18n.t('settings.integrations.everyTokenIssuedForThis')}
        actions={<Button variant={ButtonVariant.PRIMARY} icon={<FrameworkIcons.Plus size={15} />} onClick={() => { this.creating = true; }}>{AdminI18n.t('settings.integrations.createToken')}</Button>}>
        <McpTokensTable tokens={this.tokens} multiTenant={this.multiTenant} onRevoke={(token: IMcpToken) => { this.revokeCandidate = token; }} />
      </ListShell>
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
          isOpen={this.creating}
          onClose={() => { this.creating = false; }}
          onCreated={(rawKey: string) => this.created(rawKey)}
        />
        {this.renderTokens()}

        <ConfirmDialog
          isOpen={!!this.revokeCandidate}
          onClose={() => { this.revokeCandidate = null; }}
          onConfirm={() => this.revokeToken()}
          title={AdminI18n.t('settings.integrations.revokeThisToken')}
          description={AdminI18n.t('settings.integrations.stopsWorkingImmediatelyAndAny', { label: this.revokeCandidate?.label || '' })}
          confirmLabel={AdminI18n.t('settings.integrations.revoke')}
          variant={ButtonVariant.DANGER}
        />
      </>
    );
  }
}
