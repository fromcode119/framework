import type { ReactNode } from 'react';
import { state } from '@fromcode119/reactor';
import { AdminApi } from '@/lib/api';
import { AdminComponent } from '@/components/view/admin-component.client';
import { Card } from '@/components/ui/view/card.client';
import { Input } from '@/components/ui/view/input.client';
import { Badge } from '@/components/ui/view/badge.client';
import { Button } from '@/components/ui/view/button.client';
import { Loader } from '@/components/ui/view/loader.client';
import { Checkbox } from '@/components/ui/view/checkbox.client';
import { ConfirmDialog } from '@/components/ui/view/confirm-dialog.client';
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
 */
export class McpTokensPanel extends AdminComponent {
  @state loading = true;
  @state saving = false;
  @state tokens: IMcpToken[] = [];
  @state toolNames: string[] = [];
  @state label = '';
  @state selectedScopes: string[] = [];
  @state newKey: string | null = null;
  @state revokeCandidate: IMcpToken | null = null;

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

  /** One `<group>.*` per namespace, derived from the tools that actually exist. */
  private get scopeOptions(): string[] {
    const groups = new Set<string>();
    for (const name of this.toolNames) groups.add(`${name.split('.')[0]}.*`);
    for (const token of this.tokens) for (const scope of token.scopes) groups.add(scope);
    return [...groups].sort();
  }

  private toggleScope(scope: string): void {
    this.selectedScopes = this.selectedScopes.includes(scope)
      ? this.selectedScopes.filter((s) => s !== scope)
      : [...this.selectedScopes, scope];
  }

  private async createToken(): Promise<void> {
    if (!this.label.trim()) {
      this.runtime.notify.addNotification({
        type: NotificationType.ERROR,
        title: 'A label is required',
        message: 'Name the token so it can be recognised later.',
      });
      return;
    }
    this.saving = true;
    try {
      const response = await AdminApi.post('/mcp/tokens', {
        label: this.label.trim(),
        scopes: this.selectedScopes,
      });
      if (!this.mounted) return;
      this.newKey = String(response?.rawKey || '');
      this.label = '';
      this.selectedScopes = [];
      await this.load();
    } catch (error: any) {
      this.notifyError('Failed to create token', error);
    } finally {
      if (this.mounted) this.saving = false;
    }
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

  private renderCreate(): ReactNode {
    const options = this.scopeOptions;
    return this.section(
      'Create a token',
      'Name the token, choose what it may reach, then copy the key once.',
      <div className="flex flex-col gap-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="Label"
            placeholder="e.g. laptop"
            size={FieldSize.MD}
            value={this.label}
            onChange={(e: any) => { this.label = e?.target?.value ?? ''; }}
          />
        </div>

        <div className="flex flex-col gap-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Scopes</h3>
            <p className="text-sm text-slate-500 mt-1">
              Scopes only narrow what this token may reach. They never grant more than the owning user already has.
            </p>
          </div>
          {options.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 dark:border-slate-800 px-4 py-8 text-center">
              <p className="text-sm text-slate-500">
                No tools are registered yet, so there is nothing to scope. A token created now is unrestricted.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {options.map((scope) => (
                <div key={scope} className="rounded-xl border border-slate-200 dark:border-slate-800 px-3 py-2.5">
                  <Checkbox
                    checked={this.selectedScopes.includes(scope)}
                    onChange={() => this.toggleScope(scope)}
                    label={
                      <span className="flex items-center gap-2">
                        <code className="font-mono text-xs text-slate-700 dark:text-slate-200">{scope}</code>
                        {scope.startsWith('deploy.') ? <Badge variant={BadgeVariant.DANGER}>restarts services</Badge> : null}
                      </span>
                    }
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex justify-end">
          <Button variant={ButtonVariant.PRIMARY} size={FieldSize.MD} isLoading={this.saving} onClick={() => this.createToken()}>
            Create token
          </Button>
        </div>
      </div>,
    );
  }

  private renderTokens(): ReactNode {
    const body = !this.tokens.length ? (
      <div className="rounded-xl border border-dashed border-slate-200 dark:border-slate-800 px-4 py-8 text-center">
        <p className="text-sm text-slate-500">No tokens yet.</p>
      </div>
    ) : (
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-100 dark:border-slate-800 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
            <tr>
              <th className="py-3 pr-4">Label</th>
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
                <td className="py-3 pr-4">
                  {token.scopes.length ? (
                    <span className="flex flex-wrap gap-1">
                      {token.scopes.map((scope) => (
                        <Badge key={scope} variant={BadgeVariant.GRAY}>{scope}</Badge>
                      ))}
                    </span>
                  ) : (
                    <Badge variant={BadgeVariant.WARNING}>unrestricted</Badge>
                  )}
                </td>
                <td className="py-3 pr-4 text-slate-500">{token.createdAt || '—'}</td>
                <td className="py-3 pr-4 text-slate-500">{token.lastUsedAt || 'never'}</td>
                <td className="py-3 text-right">
                  <Button variant={ButtonVariant.DANGER} size={FieldSize.SM} onClick={() => { this.revokeCandidate = token; }}>
                    Revoke
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );

    return this.section('Existing tokens', 'Every token issued for this installation. Revoking one takes effect immediately.', body);
  }

  render(): ReactNode {
    if (this.loading) return <Loader />;

    return (
      <>
        {this.renderNewKey()}
        {this.renderCreate()}
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
