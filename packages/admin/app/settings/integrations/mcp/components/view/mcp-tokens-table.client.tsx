import type { ReactNode } from 'react';
import { prop } from '@fromcode119/react-class-components';
import { AdminComponent } from '@/components/view/admin-component.client';
import { Badge } from '@/components/ui/view/badge.client';
import { Button } from '@/components/ui/view/button.client';
import { ButtonVariant } from '@/components/ui/enums/button-variant.enum';
import { BadgeVariant } from '@/components/ui/enums/badge-variant.enum';
import { DataTable } from '@/components/ui/view/data-table.client';
import { ListShell } from '@/components/ui/view/list-shell.client';
import { EmptyState } from '@/components/ui/view/empty-state.client';
import type { IMcpToken } from '@/app/settings/integrations/mcp/interfaces/mcp-token.interface';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

/**
 * The issued tokens, one row each. The SITE column is what tells an operator which site a key can
 * reach: a named site, or "all sites" for a platform token. A legacy token (issued before tokens
 * recorded a site) is bound to the site whose admin issued it, and says so.
 */
export class McpTokensTable extends AdminComponent {
  declare props: Pick<McpTokensTable, 'tokens' | 'multiTenant' | 'onRevoke'>;

  @prop declare tokens: IMcpToken[];
  @prop declare multiTenant: boolean;
  @prop declare onRevoke: (token: IMcpToken) => void;

  private siteCell(token: IMcpToken): ReactNode {
    if (token.site === null) return <Badge variant={BadgeVariant.WARNING}>{AdminI18n.t('settings.integrations.allSites')}</Badge>;
    return (
      <span className="fc-dt-inline">
        <Badge variant={BadgeVariant.GRAY}>{token.site}</Badge>
        {token.legacy ? <span className="fc-dt-quiet">{AdminI18n.t('settings.integrations.issuedBeforeSites')}</span> : null}
      </span>
    );
  }

  private scopesCell(token: IMcpToken): ReactNode {
    if (!token.scopes.length) return <Badge variant={BadgeVariant.WARNING}>{AdminI18n.t('settings.integrations.unrestricted')}</Badge>;
    return <span className="fc-chip-row fc-chip-row--cell">{token.scopes.map((scope) => <Badge key={scope} variant={BadgeVariant.GRAY}>{scope}</Badge>)}</span>;
  }

  private get columns(): any[] {
    return [
      { header: AdminI18n.t('settings.integrations.label'), id: 'label', accessor: (token: IMcpToken) => <span className="fc-dt-strong">{token.label}</span> },
      ...(this.multiTenant ? [{ header: AdminI18n.t('settings.integrations.site'), id: 'site', accessor: (token: IMcpToken) => this.siteCell(token) }] : []),
      { header: AdminI18n.t('settings.integrations.scopes'), id: 'scopes', className: 'fc-dt-fill fc-dt-wrap', accessor: (token: IMcpToken) => this.scopesCell(token) },
      { header: AdminI18n.t('settings.integrations.created'), id: 'created', accessor: (token: IMcpToken) => token.createdAt || '—' },
      { header: AdminI18n.t('settings.integrations.lastUsed'), id: 'lastUsed', accessor: (token: IMcpToken) => token.lastUsedAt || AdminI18n.t('settings.integrations.never') },
    ];
  }

  render(): ReactNode {
    if (!this.tokens.length) return <EmptyState inline title={AdminI18n.t('settings.integrations.noTokensYet')} />;
    return (
      <ListShell>
        <DataTable
          columns={this.columns}
          data={this.tokens.map((token) => ({ ...token, id: token.tokenId }))}
          actions={(token: IMcpToken) => (
            <Button variant={ButtonVariant.GHOST} onClick={() => this.onRevoke(token)}>{AdminI18n.t('settings.integrations.revoke')}</Button>
          )}
        />
      </ListShell>
    );
  }
}
