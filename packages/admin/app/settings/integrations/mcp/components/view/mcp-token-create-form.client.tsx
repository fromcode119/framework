import { EmptyState } from '@/components/ui/view/empty-state.client';
import { RecordCard } from '@/components/ui/view/record-card.client';
import { Text } from '@/components/ui/view/text.client';
import { Hint } from '@/components/ui/view/hint.client';
import { Heading } from '@/components/ui/view/heading.client';
import type { ReactNode } from 'react';
import { prop, state } from '@fromcode119/react-class-components';
import { AdminApi } from '@/lib/api';
import { AdminComponent } from '@/components/view/admin-component.client';
import { Card } from '@/components/ui/view/card.client';
import { Input } from '@/components/ui/view/input.client';
import { Badge } from '@/components/ui/view/badge.client';
import { Button } from '@/components/ui/view/button.client';
import { Checkbox } from '@/components/ui/view/checkbox.client';
import { Select } from '@/components/ui/view/select.client';
import { ButtonVariant } from '@/components/ui/enums/button-variant.enum';
import { BadgeVariant } from '@/components/ui/enums/badge-variant.enum';
import { FieldSize } from '@/components/ui/enums/field-size.enum';
import { NotificationType } from '@/components/enums/notification-type.enum';
import type { IMcpToken } from '@/app/settings/integrations/mcp/interfaces/mcp-token.interface';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

/**
 * Issues one token: a label, the scopes it may reach, and — on a multi-site platform — which SITE it
 * acts on. The scope choices come from the LIVE tool list, never a hardcoded array. The "all sites"
 * choice exists for the platform admin only; a site admin's token is bound to their site, shown as a
 * locked field so the binding is visible rather than implied.
 */
export class McpTokenCreateForm extends AdminComponent {
  static readonly ALL_SITES = 'all';

  declare props: Pick<McpTokenCreateForm, 'toolNames' | 'tokens' | 'multiTenant' | 'platformAdmin' | 'currentSite' | 'onCreated'>;

  @prop declare toolNames: string[];
  @prop declare tokens: IMcpToken[];
  @prop declare multiTenant: boolean;
  @prop declare platformAdmin: boolean;
  @prop declare currentSite: string | null;
  @prop declare onCreated: (rawKey: string) => void;

  @state saving = false;
  @state label = '';
  @state selectedScopes: string[] = [];
  /** `''` = this site (the default); `'all'` = every site. */
  @state site = '';

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
      this.runtime.notify.addNotification({ type: NotificationType.ERROR, title: AdminI18n.t('settings.integrations.aLabelIsRequired'), message: AdminI18n.t('settings.integrations.nameTheTokenSoIt') });
      return;
    }
    this.saving = true;
    try {
      const response = await AdminApi.post('/mcp/tokens', {
        label: this.label.trim(),
        scopes: this.selectedScopes,
        site: this.site === McpTokenCreateForm.ALL_SITES ? McpTokenCreateForm.ALL_SITES : undefined,
      });
      this.label = '';
      this.selectedScopes = [];
      this.site = '';
      this.onCreated(String(response?.rawKey || ''));
    } catch (error: any) {
      this.runtime.notify.addNotification({ type: NotificationType.ERROR, title: AdminI18n.t('settings.integrations.failedToCreateToken'), message: error?.message || AdminI18n.t('settings.integrations.unexpectedError') });
    } finally {
      this.saving = false;
    }
  }

  private renderSiteChoice(): ReactNode {
    if (!this.multiTenant) return null;
    const here = this.currentSite ? AdminI18n.t('settings.integrations.thisSite', { currentSite: this.currentSite }) : AdminI18n.t('settings.integrations.thisSite2');
    if (!this.platformAdmin) {
      return <Input label={AdminI18n.t('settings.integrations.site')} size={FieldSize.MD} value={here} disabled onChange={() => undefined} />;
    }
    return (
      <Select
        label={AdminI18n.t('settings.integrations.site')}
        size={FieldSize.MD}
        value={this.site}
        onChange={(value: string) => { this.site = value; }}
        options={[
          { value: '', label: here },
          { value: McpTokenCreateForm.ALL_SITES, label: AdminI18n.t('settings.integrations.allSitesTheClientPicks') },
        ]}
      />
    );
  }

  private renderScopes(): ReactNode {
    const options = this.scopeOptions;
    if (options.length === 0) {
      return <EmptyState inline title={AdminI18n.t('settings.integrations.noToolsAreRegisteredYet')} />;
    }
    return (
      <div className="fc-columns" data-count="3">
        {options.map((scope) => (
          <Checkbox
            key={scope}
            checked={this.selectedScopes.includes(scope)}
            onChange={() => this.toggleScope(scope)}
            label={
              <span className="fc-chip-row fc-chip-row--cell">
                <code>{scope}</code>
                {scope.startsWith('deploy.') ? <Badge variant={BadgeVariant.DANGER}>{AdminI18n.t('settings.integrations.restartsServices')}</Badge> : null}
              </span>
            }
          />
        ))}
      </div>
    );
  }

  render(): ReactNode {
    return (
      <RecordCard title={AdminI18n.t('settings.integrations.createAToken')}>
        <div className="fc-form-stack">
          <Text size="small" muted as="p">{AdminI18n.t('settings.integrations.nameTheTokenChooseWhat')}</Text>
          <div className="fc-form-grid">
            <Input label={AdminI18n.t('settings.integrations.label')} placeholder={AdminI18n.t('settings.integrations.labelExample')} value={this.label} onChange={(e: any) => { this.label = e?.target?.value ?? ''; }} />
            {this.renderSiteChoice()}
          </div>
          <div className="fc-field-stack">
            <Heading level="h3">{AdminI18n.t('settings.integrations.scopes')}</Heading>
            <Hint>{AdminI18n.t('settings.integrations.scopesOnlyNarrowWhatThis')}</Hint>
            {this.renderScopes()}
          </div>
          <div className="fc-form-foot">
            <Button variant={ButtonVariant.PRIMARY} isLoading={this.saving} onClick={() => this.createToken()}>{AdminI18n.t('settings.integrations.createToken')}</Button>
          </div>
        </div>
      </RecordCard>
    );
  }
}
