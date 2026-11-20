import { ButtonVariant } from '@/components/ui/enums/button-variant.enum';
import { BadgeVariant } from '@/components/ui/enums/badge-variant.enum';
import type { ReactNode } from 'react';
import { PureReactor, prop, state } from '@fromcode119/react-class-components';
import { ListShell } from '@/components/ui/view/list-shell.client';
import { ListRow } from '@/components/ui/view/list-row.client';
import { IconBadge } from '@/components/ui/view/icon-badge.client';
import { Badge } from '@/components/ui/view/badge.client';
import { Button } from '@/components/ui/view/button.client';
import { EmptyState } from '@/components/ui/view/empty-state.client';
import { EditSheet } from '@/components/ui/view/edit-sheet.client';
import { RecordCard } from '@/components/ui/view/record-card.client';
import { StateBadge } from '@/components/ui/view/state-badge.client';
import { CodeBlock } from '@/components/ui/view/code-block.client';
import { Input } from '@/components/ui/view/input.client';
import { Label } from '@/components/ui/view/label.client';
import { NumberStepper } from '@/components/ui/number-stepper';
import { Loader } from '@/components/ui/view/loader.client';
import { FrameworkIcons } from '@fromcode119/react';
import type { IUserApiTokenRecord } from '@/app/users/[id]/security/interfaces/user-api-token-record.interface';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

/**
 * The account's own API tokens: one row each, a new one made from a drawer, and its key shown once
 * above the list — the way the MCP token list does it.
 */
export class UserApiTokensCard extends PureReactor {
  @prop declare createdToken: string;
  @prop declare onCreateToken: () => Promise<boolean>;
  @prop declare onDismissCreatedToken: () => void;
  @prop declare onRevokeToken: (token: IUserApiTokenRecord) => void;
  @prop declare setTokenDays: (value: string) => void;
  @prop declare setTokenName: (value: string) => void;
  @prop declare tokenDays: string;
  @prop declare tokenName: string;
  @prop declare tokens: IUserApiTokenRecord[];
  @prop declare tokensLoading: boolean;

  @state private creating = false;
  @state private saving = false;

  private async create(): Promise<void> {
    this.saving = true;
    try {
      if (await this.onCreateToken()) this.creating = false;
    } finally {
      this.saving = false;
    }
  }

  private description(token: IUserApiTokenRecord): string {
    const created = token.createdAt ? AdminI18n.t('users.createdOn', { date: new Date(token.createdAt).toLocaleDateString(AdminI18n.locale) }) : '';
    return [token.prefix || '', created].filter(Boolean).join(' · ');
  }

  private renderCreatedToken(): ReactNode {
    if (!this.createdToken) return null;
    return (
      <RecordCard title={AdminI18n.t('users.copyTheTokenNowIt')} aside={<StateBadge tone="warning">{AdminI18n.t('settings.integrations.shownOnce')}</StateBadge>}>
        <div className="fc-form-stack">
          <CodeBlock code={this.createdToken} />
          <div><Button variant={ButtonVariant.SECONDARY} onClick={this.onDismissCreatedToken}>{AdminI18n.t('users.done')}</Button></div>
        </div>
      </RecordCard>
    );
  }

  private renderRows(): ReactNode {
    if (this.tokensLoading) return <Loader label={AdminI18n.t('users.loadingApiTokens')} />;
    if (this.tokens.length === 0) return <EmptyState inline icon={<FrameworkIcons.Key size={16} />} title={AdminI18n.t('users.noApiTokensCreatedYet')} />;
    return this.tokens.map((token) => (
      <ListRow
        key={String(token.id)}
        icon={<IconBadge tone={token.revokedAt ? 'neutral' : 'info'}><FrameworkIcons.Key size={14} /></IconBadge>}
        title={<span className="fc-ext-row__plain">{token.name || AdminI18n.t('users.token')}</span>}
        badges={token.revokedAt ? <Badge variant={BadgeVariant.DANGER}>{AdminI18n.t('users.revokedOn', { date: new Date(token.revokedAt).toLocaleDateString(AdminI18n.locale) })}</Badge> : null}
        description={this.description(token) || undefined}
        actions={token.revokedAt ? null : <Button variant={ButtonVariant.OUTLINE} onClick={() => this.onRevokeToken(token)}>{AdminI18n.t('users.revoke')}</Button>}
      />
    ));
  }

  render(): ReactNode {
    return (
      <>
        {this.renderCreatedToken()}
        <ListShell
          title={AdminI18n.t('users.personalApiTokens')}
          count={this.tokensLoading ? null : this.tokens.length}
          actions={<Button variant={ButtonVariant.PRIMARY} icon={<FrameworkIcons.Plus size={15} />} onClick={() => { this.creating = true; }}>{AdminI18n.t('users.createToken')}</Button>}
        >
          <div>{this.renderRows()}</div>
        </ListShell>
        <EditSheet
          isOpen={this.creating}
          onClose={() => { this.creating = false; }}
          onSave={() => void this.create()}
          saving={this.saving}
          saveLabel={AdminI18n.t('users.createToken')}
          title={AdminI18n.t('users.createToken')}
        >
          <div className="fc-form-stack">
            <Input label={AdminI18n.t('users.name')} placeholder={AdminI18n.t('users.tokenNameEGCi')} value={this.tokenName} autoFocus onChange={(event: any) => this.setTokenName(event?.target?.value ?? '')} />
            <div className="fc-field-stack">
              <Label>{AdminI18n.t('users.validForDays')}</Label>
              <NumberStepper min={1} max={3650} value={this.tokenDays} onChange={(value) => this.setTokenDays(value === '' ? '' : String(value))} />
            </div>
          </div>
        </EditSheet>
      </>
    );
  }
}
