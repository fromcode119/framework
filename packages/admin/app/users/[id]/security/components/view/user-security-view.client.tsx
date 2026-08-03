import { ButtonVariant } from '@/components/ui/enums/button-variant.enum';
import { ThemeMode } from '@fromcode119/core/client';
import type { ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/reactor';
import Link from 'next/link';
import { Button } from '@/components/ui/view/button.client';
import { Loader } from '@/components/ui/view/loader.client';
import { Card } from '@/components/ui/view/card.client';
import { FrameworkIcons } from '@fromcode119/react';
import { AdminConstants } from '@/lib/constants/admin.constants';
import { UserSecurityPageService } from '@/app/users/[id]/security/user-security-page-service';
import type { IUserSecurityPageModel } from '@/app/users/[id]/security/interfaces/user-security-page-model.interface';
import { UserSecurityHeader } from '@/app/users/[id]/security/components/view/user-security-header.client';
import { TwoFactorSecurityCard } from '@/app/users/[id]/security/components/view/two-factor-security-card.client';
import { SecurityRecommendationsCard } from '@/app/users/[id]/security/components/view/security-recommendations-card.client';
import { DeviceSessionsCard } from '@/app/users/[id]/security/components/view/device-sessions-card.client';
import { UserApiTokensCard } from '@/app/users/[id]/security/components/view/user-api-tokens-card.client';
import { AuthActivityCard } from '@/app/users/[id]/security/components/view/auth-activity-card.client';

export class UserSecurityView extends PureReactor {
  @prop declare model: IUserSecurityPageModel;

  render(): ReactNode {
    const model = this.model;
    if (model.loading) {
    return <div className="flex-1 flex items-center justify-center min-h-screen"><Loader label="Loading Security Settings..." /></div>;
  }

  if (!model.user) {
    return <div className="flex-1 flex flex-col items-center justify-center min-h-screen space-y-4"><h1 className="text-2xl font-semibold text-slate-400 tracking-tight">User Not Found</h1><Link href={AdminConstants.ROUTES.USERS.ROOT}><Button variant={ButtonVariant.GHOST}>Return to Users</Button></Link></div>;
  }

  return (
    <div className="w-full min-h-screen flex flex-col animate-in fade-in duration-500">
      <UserSecurityHeader backHref={model.routerBackHref} email={model.user.email || ''} isDark={model.themeMode === ThemeMode.DARK} />
      <div className="flex-1 w-full max-w-3xl mx-auto px-6 py-12 space-y-8">
        <TwoFactorSecurityCard copyRecoveryCodes={model.copyRecoveryCodes} generatedRecoveryCodes={model.generatedRecoveryCodes} handleDisable2FA={model.handleDisable2FA} handleEnable2FA={model.handleEnable2FA} handleRegenerateRecoveryCodes={model.handleRegenerateRecoveryCodes} handleVerify2FA={model.handleVerify2FA} isDark={model.themeMode === ThemeMode.DARK} isEnabling={model.isEnabling} isRegeneratingCodes={model.isRegeneratingCodes} isVerifying={model.isVerifying} qrCode={model.qrCode} recoveryCodesRemaining={model.recoveryCodesRemaining} secret={model.secret} setVerificationCode={model.setVerificationCode} twoFactorEnabled={model.twoFactorEnabled} verificationCode={model.verificationCode} />
        <SecurityRecommendationsCard isAdministrator={UserSecurityPageService.isAdministrator(model.user)} isDark={model.themeMode === ThemeMode.DARK} twoFactorEnabled={model.twoFactorEnabled} />
        {model.isSelf ? <>
          <DeviceSessionsCard isDark={model.themeMode === ThemeMode.DARK} sessions={model.mySessions} sessionsLoading={model.sessionsLoading} onRevokeOtherSessions={model.revokeOtherSessions} onRevokeSession={model.revokeSession} />
          <UserApiTokensCard createdToken={model.createdToken} isDark={model.themeMode === ThemeMode.DARK} onCreateToken={model.createApiToken} onRevokeToken={model.revokeApiToken} setTokenDays={model.setTokenDays} setTokenName={model.setTokenName} tokenDays={model.tokenDays} tokenName={model.tokenName} tokens={model.myApiTokens} tokensLoading={model.tokensLoading} />
        </> : <Card title="Self-Service Security Controls" icon={<FrameworkIcons.Key size={18} className="text-indigo-500" />}><div className="text-xs font-bold uppercase tracking-tight text-slate-400">Session/device controls and personal API tokens are available only when viewing your own user account.</div></Card>}
        <AuthActivityCard activity={model.authActivity} activityLoading={model.authActivityLoading} email={String(model.user.email || '')} isDark={model.themeMode === ThemeMode.DARK} />
      </div>
    </div>
  );
  }
}
