import { ButtonVariant } from '@/components/ui/enums/button-variant.enum';
import { ThemeMode } from '@fromcode119/core/client';
import type { ReactNode } from 'react';
import { PureReactor, prop, state } from '@fromcode119/react-class-components';
import { AdminLink } from '@/components/view/admin-link.client';
import { Button } from '@/components/ui/view/button.client';
import { Loader } from '@/components/ui/view/loader.client';
import { Card } from '@/components/ui/view/card.client';
import { Hint } from '@/components/ui/view/hint.client';
import { StatePage } from '@/components/ui/view/state-page.client';
import { ConfirmDialog } from '@/components/ui/view/confirm-dialog.client';
import { AdminConstants } from '@/lib/constants/admin.constants';
import { UserSecurityPageService } from '@/app/users/[id]/security/user-security-page-service';
import type { IUserSecurityPageModel } from '@/app/users/[id]/security/interfaces/user-security-page-model.interface';
import type { IUserSessionRecord } from '@/app/users/[id]/security/interfaces/user-session-record.interface';
import type { IUserApiTokenRecord } from '@/app/users/[id]/security/interfaces/user-api-token-record.interface';
import type { IUserSecurityConfirm } from '@/app/users/[id]/security/interfaces/user-security-confirm.interface';
import { UserSecurityHeader } from '@/app/users/[id]/security/components/view/user-security-header.client';
import { TwoFactorSecurityCard } from '@/app/users/[id]/security/components/view/two-factor-security-card.client';
import { DeviceSessionsCard } from '@/app/users/[id]/security/components/view/device-sessions-card.client';
import { UserApiTokensCard } from '@/app/users/[id]/security/components/view/user-api-tokens-card.client';
import { AuthActivityCard } from '@/app/users/[id]/security/components/view/auth-activity-card.client';
import { AdminClass } from '@/lib/admin-class';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

export class UserSecurityView extends PureReactor {
  @prop declare model: IUserSecurityPageModel;

  /** The step waiting for a yes: the console's own dialog, not the browser's. */
  @state private confirming: IUserSecurityConfirm | null = null;
  @state private running = false;

  private ask(confirming: IUserSecurityConfirm): void {
    this.confirming = confirming;
  }

  private async confirm(): Promise<void> {
    const confirming = this.confirming;
    if (!confirming) return;
    this.running = true;
    try {
      await confirming.run();
    } finally {
      this.running = false;
      this.confirming = null;
    }
  }

  private renderSelf(model: IUserSecurityPageModel): ReactNode {
    if (!model.isSelf) {
      return <Card title={AdminI18n.t('users.selfServiceSecurityControls')}><Hint>{AdminI18n.t('users.sessionDeviceControlsAndPersonal')}</Hint></Card>;
    }
    return (
      <>
        <DeviceSessionsCard
          sessions={model.mySessions}
          sessionsLoading={model.sessionsLoading}
          onRevokeOtherSessions={() => this.ask({ title: AdminI18n.t('users.revokeOtherSessions'), description: AdminI18n.t('users.revokeOtherSessionsConfirm'), confirmLabel: AdminI18n.t('users.revokeOtherSessions'), run: model.revokeOtherSessions })}
          onRevokeSession={(session: IUserSessionRecord) => this.ask({ title: AdminI18n.t('users.revokeAccess'), description: AdminI18n.t(session.isCurrent ? 'users.revokeCurrentSessionConfirm' : 'users.revokeSessionConfirm'), confirmLabel: AdminI18n.t('users.revoke'), run: () => model.revokeSession(String(session.id)) })}
        />
        <UserApiTokensCard
          createdToken={model.createdToken}
          onCreateToken={model.createApiToken}
          onDismissCreatedToken={model.dismissCreatedToken}
          onRevokeToken={(token: IUserApiTokenRecord) => this.ask({ title: AdminI18n.t('users.revokeAccess'), description: AdminI18n.t('users.revokeTokenConfirm', { name: token.name || AdminI18n.t('users.token') }), confirmLabel: AdminI18n.t('users.revoke'), run: () => model.revokeApiToken(String(token.id)) })}
          setTokenDays={model.setTokenDays}
          setTokenName={model.setTokenName}
          tokenDays={model.tokenDays}
          tokenName={model.tokenName}
          tokens={model.myApiTokens}
          tokensLoading={model.tokensLoading}
        />
      </>
    );
  }

  render(): ReactNode {
    const model = this.model;
    if (model.loading) {
      return <div className="fc-page-stack"><Loader label={AdminI18n.t('users.loadingSecuritySettings')} /></div>;
    }

    if (!model.user) {
      return <StatePage title={AdminI18n.t('users.userNotFound')} actions={<AdminLink href={AdminConstants.ROUTES.USERS.ROOT}><Button variant={ButtonVariant.SECONDARY}>{AdminI18n.t('users.returnToUsers')}</Button></AdminLink>} />;
    }

    return (
      <div className={`w-full flex flex-col ${AdminClass.of('settings-page')}`}>
        <UserSecurityHeader backHref={model.routerBackHref} email={model.user.email || ''} isDark={model.themeMode === ThemeMode.DARK} />
        <div className="w-full py-6 fc-page-stack">
          <TwoFactorSecurityCard
            generatedRecoveryCodes={model.generatedRecoveryCodes}
            isAdministrator={UserSecurityPageService.isAdministrator(model.user)}
            isEnabling={model.isEnabling}
            isRegeneratingCodes={model.isRegeneratingCodes}
            isVerifying={model.isVerifying}
            onCopyRecoveryCodes={model.copyRecoveryCodes}
            onDisable={() => this.ask({ title: AdminI18n.t('users.disable2fa'), description: AdminI18n.t('users.areYouSureYouWant2'), confirmLabel: AdminI18n.t('users.disable2fa'), run: model.handleDisable2FA })}
            onEnable={model.handleEnable2FA}
            onRegenerate={() => this.ask({ title: AdminI18n.t('users.regenerateRecoveryCodes'), description: AdminI18n.t('users.regenerateRecoveryCodesExistingUnused'), confirmLabel: AdminI18n.t('users.regenerateRecoveryCodes'), run: model.handleRegenerateRecoveryCodes })}
            onVerify={model.handleVerify2FA}
            qrCode={model.qrCode}
            recoveryCodesRemaining={model.recoveryCodesRemaining}
            secret={model.secret}
            setVerificationCode={model.setVerificationCode}
            twoFactorEnabled={model.twoFactorEnabled}
            twoFactorAvailable={model.twoFactorAvailable}
            verificationCode={model.verificationCode}
          />
          {this.renderSelf(model)}
          {model.canReadLogs ? <AuthActivityCard activity={model.authActivity} activityLoading={model.authActivityLoading} email={String(model.user.email || '')} /> : null}
        </div>
        <ConfirmDialog
          isOpen={!!this.confirming}
          onClose={() => { if (!this.running) this.confirming = null; }}
          onConfirm={() => void this.confirm()}
          title={this.confirming?.title || ''}
          description={this.confirming?.description || ''}
          confirmLabel={this.confirming?.confirmLabel}
          variant={ButtonVariant.DANGER}
          isLoading={this.running}
        />
      </div>
    );
  }
}
