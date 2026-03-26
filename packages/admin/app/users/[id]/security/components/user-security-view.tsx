"use client";

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Loader } from '@/components/ui/loader';
import { Card } from '@/components/ui/card';
import { FrameworkIcons } from '@/lib/icons';
import { AdminConstants } from '@/lib/constants';
import { UserSecurityPageService } from '../user-security-page-service';
import type { UserSecurityPageModel } from '../user-security-page.interfaces';
import UserSecurityHeader from './user-security-header';
import TwoFactorSecurityCard from './two-factor-security-card';
import SecurityRecommendationsCard from './security-recommendations-card';
import DeviceSessionsCard from './device-sessions-card';
import UserApiTokensCard from './user-api-tokens-card';
import AuthActivityCard from './auth-activity-card';

export default function UserSecurityView({ model }: { model: UserSecurityPageModel }) {
  if (model.loading) {
    return <div className="flex-1 flex items-center justify-center min-h-screen"><Loader label="Loading Security Settings..." /></div>;
  }

  if (!model.user) {
    return <div className="flex-1 flex flex-col items-center justify-center min-h-screen space-y-4"><h1 className="text-2xl font-semibold text-slate-400 tracking-tight">User Not Found</h1><Link href={AdminConstants.ROUTES.USERS.ROOT}><Button variant="ghost">Return to Users</Button></Link></div>;
  }

  return (
    <div className="w-full min-h-screen flex flex-col animate-in fade-in duration-500">
      <UserSecurityHeader backHref={model.routerBackHref} email={model.user.email || ''} isDark={model.themeMode === 'dark'} />
      <div className="flex-1 w-full max-w-3xl mx-auto px-6 py-12 space-y-8">
        <TwoFactorSecurityCard copyRecoveryCodes={model.copyRecoveryCodes} generatedRecoveryCodes={model.generatedRecoveryCodes} handleDisable2FA={model.handleDisable2FA} handleEnable2FA={model.handleEnable2FA} handleRegenerateRecoveryCodes={model.handleRegenerateRecoveryCodes} handleVerify2FA={model.handleVerify2FA} isDark={model.themeMode === 'dark'} isEnabling={model.isEnabling} isRegeneratingCodes={model.isRegeneratingCodes} isVerifying={model.isVerifying} qrCode={model.qrCode} recoveryCodesRemaining={model.recoveryCodesRemaining} secret={model.secret} setVerificationCode={model.setVerificationCode} twoFactorEnabled={model.twoFactorEnabled} verificationCode={model.verificationCode} />
        <SecurityRecommendationsCard isAdministrator={UserSecurityPageService.isAdministrator(model.user)} isDark={model.themeMode === 'dark'} twoFactorEnabled={model.twoFactorEnabled} />
        {model.isSelf ? <>
          <DeviceSessionsCard isDark={model.themeMode === 'dark'} sessions={model.mySessions} sessionsLoading={model.sessionsLoading} onRevokeOtherSessions={model.revokeOtherSessions} onRevokeSession={model.revokeSession} />
          <UserApiTokensCard createdToken={model.createdToken} isDark={model.themeMode === 'dark'} onCreateToken={model.createApiToken} onRevokeToken={model.revokeApiToken} setTokenDays={model.setTokenDays} setTokenName={model.setTokenName} tokenDays={model.tokenDays} tokenName={model.tokenName} tokens={model.myApiTokens} tokensLoading={model.tokensLoading} />
        </> : <Card title="Self-Service Security Controls" icon={<FrameworkIcons.Key size={18} className="text-indigo-500" />}><div className="text-xs font-bold uppercase tracking-tight text-slate-400">Session/device controls and personal API tokens are available only when viewing your own user account.</div></Card>}
        <AuthActivityCard activity={model.authActivity} activityLoading={model.authActivityLoading} email={String(model.user.email || '')} isDark={model.themeMode === 'dark'} />
      </div>
    </div>
  );
}
