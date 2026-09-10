import type { ReactNode } from 'react';
import { prop } from '@fromcode119/react-class-components';
import { AdminComponent } from '@/components/view/admin-component.client';
import { Badge } from '@/components/ui/view/badge.client';
import { Button } from '@/components/ui/view/button.client';
import { ButtonVariant } from '@/components/ui/enums/button-variant.enum';
import { BadgeVariant } from '@/components/ui/enums/badge-variant.enum';
import { FieldSize } from '@/components/ui/enums/field-size.enum';
import type { IMcpToken } from '@/app/settings/integrations/mcp/interfaces/mcp-token.interface';

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
    if (token.site === null) return <Badge variant={BadgeVariant.WARNING}>all sites</Badge>;
    return (
      <span className="flex flex-wrap items-center gap-1">
        <Badge variant={BadgeVariant.GRAY}>{token.site}</Badge>
        {token.legacy ? <span className="text-xs text-slate-500">issued before sites</span> : null}
      </span>
    );
  }

  private scopesCell(token: IMcpToken): ReactNode {
    if (!token.scopes.length) return <Badge variant={BadgeVariant.WARNING}>unrestricted</Badge>;
    return (
      <span className="flex flex-wrap gap-1">
        {token.scopes.map((scope) => <Badge key={scope} variant={BadgeVariant.GRAY}>{scope}</Badge>)}
      </span>
    );
  }

  render(): ReactNode {
    if (!this.tokens.length) {
      return (
        <div className="rounded-xl border border-dashed border-slate-200 dark:border-slate-800 px-4 py-8 text-center">
          <p className="text-sm text-slate-500">No tokens yet.</p>
        </div>
      );
    }
    return (
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-100 dark:border-slate-800 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
            <tr>
              <th className="py-3 pr-4">Label</th>
              {this.multiTenant ? <th className="py-3 pr-4">Site</th> : null}
              <th className="py-3 pr-4">Scopes</th>
              <th className="py-3 pr-4">Created</th>
              <th className="py-3 pr-4">Last used</th>
              <th className="py-3" />
            </tr>
          </thead>
          <tbody>
            {this.tokens.map((token) => (
              <tr key={token.tokenId} className="border-b border-slate-100 last:border-0 dark:border-slate-800">
                <td className="py-3 pr-4 font-semibold text-slate-900 dark:text-white">{token.label}</td>
                {this.multiTenant ? <td className="py-3 pr-4">{this.siteCell(token)}</td> : null}
                <td className="py-3 pr-4">{this.scopesCell(token)}</td>
                <td className="py-3 pr-4 text-slate-500">{token.createdAt || '—'}</td>
                <td className="py-3 pr-4 text-slate-500">{token.lastUsedAt || 'never'}</td>
                <td className="py-3 text-right">
                  <Button variant={ButtonVariant.DANGER} size={FieldSize.SM} onClick={() => this.onRevoke(token)}>
                    Revoke
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }
}
