import { ButtonVariant } from '@/components/ui/enums/button-variant.enum';
import { FieldSize } from '@/components/ui/enums/field-size.enum';
import type { ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/react-class-components';
import { Card } from '@/components/ui/view/card.client';
import { Button } from '@/components/ui/view/button.client';
import { Input } from '@/components/ui/view/input.client';
import { FrameworkIcons } from '@fromcode119/react';
import { AdminClass } from '@/lib/admin-class';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

export class TwoFactorSecurityCard extends PureReactor {
  @prop declare copyRecoveryCodes: () => Promise<void>;
  @prop declare generatedRecoveryCodes: string[];
  @prop declare handleDisable2FA: () => Promise<void>;
  @prop declare handleEnable2FA: () => Promise<void>;
  @prop declare handleRegenerateRecoveryCodes: () => Promise<void>;
  @prop declare handleVerify2FA: () => Promise<void>;
  @prop declare isDark: boolean;
  @prop declare isEnabling: boolean;
  @prop declare isRegeneratingCodes: boolean;
  @prop declare isVerifying: boolean;
  @prop declare qrCode: string | null;
  @prop declare recoveryCodesRemaining: number;
  @prop declare secret: string | null;
  @prop declare setVerificationCode: (value: string) => void;
  @prop declare twoFactorEnabled: boolean;
  @prop declare verificationCode: string;

  render(): ReactNode {
    const {
  copyRecoveryCodes,
  generatedRecoveryCodes,
  handleDisable2FA,
  handleEnable2FA,
  handleRegenerateRecoveryCodes,
  handleVerify2FA,
  isDark,
  isEnabling,
  isRegeneratingCodes,
  isVerifying,
  qrCode,
  recoveryCodesRemaining,
  secret,
  setVerificationCode,
  twoFactorEnabled,
  verificationCode,
} = this;
  return (
    <Card title={AdminI18n.t('users.twoFactorAuthentication')} icon={<FrameworkIcons.ShieldCheck size={20} className="text-indigo-500" />}>
      <div className="space-y-6">
        <div className="flex items-center justify-between py-4">
          <div className="space-y-1"><h3 className={`font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>{AdminI18n.t('users.2faStatus')}</h3><p className="text-xs text-slate-500">{AdminI18n.t('users.addAnExtraLayerOf')}</p></div>
          <div className="flex items-center gap-3">{twoFactorEnabled ? <div className="flex items-center gap-2"><div className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]" /><span className="text-xs font-bold text-emerald-500">ENABLED</span></div> : <div className="flex items-center gap-2"><div className="h-2 w-2 rounded-full bg-rose-500" /><span className="text-xs font-bold text-slate-500">DISABLED</span></div>}</div>
        </div>

        {!twoFactorEnabled && !qrCode ? <div className={`p-6 rounded-xl border ${isDark ? 'bg-indigo-500/5 border-indigo-500/20' : 'bg-indigo-50 border-indigo-100'}`}><h4 className="text-xs font-bold text-indigo-500 mb-2 uppercase tracking-wide">{AdminI18n.t('users.recommended')}</h4><p className="text-sm text-slate-600 dark:text-slate-300 mb-4">{AdminI18n.t('users.enableTwoFactorAuthenticationTo')}</p><Button onClick={handleEnable2FA} isLoading={isEnabling} icon={<FrameworkIcons.ShieldCheck size={16} />} className="font-bold text-xs tracking-tight uppercase">{AdminI18n.t('users.enable2fa')}</Button></div> : null}

        {qrCode && !twoFactorEnabled ? <div className="space-y-6"><div className={`p-6 ${AdminClass.SURFACE} ${isDark ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-200'}`}><h4 className="text-xs font-bold text-slate-500 mb-4 uppercase tracking-wide">{AdminI18n.t('users.step1ScanQrCode')}</h4><p className="text-sm text-slate-600 dark:text-slate-300 mb-4">{AdminI18n.t('users.useAnAuthenticatorAppLike')}</p><div className="flex justify-center py-4"><img src={qrCode} alt={AdminI18n.t('users.2faQrCode')} className="border-4 border-white rounded-xl shadow-sm" /></div>{secret ? <div className="mt-4"><p className="text-xs text-slate-500 mb-2 font-bold uppercase tracking-wide">{AdminI18n.t('users.manualEntryCode')}</p><div className={`p-3 ${AdminClass.SURFACE} font-mono text-sm ${isDark ? 'bg-slate-900 text-slate-300' : 'bg-white text-slate-700'} border ${isDark ? 'border-slate-700' : 'border-slate-200'}`}>{secret}</div></div> : null}</div><div className={`p-6 ${AdminClass.SURFACE} ${isDark ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-200'}`}><h4 className="text-xs font-bold text-slate-500 mb-4 uppercase tracking-wide">{AdminI18n.t('users.step2VerifyCode')}</h4><p className="text-sm text-slate-600 dark:text-slate-300 mb-4">{AdminI18n.t('users.enterThe6DigitCode')}</p><div className="flex gap-3"><Input type="text" placeholder="000000" maxLength={6} value={verificationCode} onChange={(event) => setVerificationCode(event.target.value)} className="font-mono text-lg text-center tracking-widest" /><Button onClick={handleVerify2FA} isLoading={isVerifying} disabled={verificationCode.length !== 6} icon={<FrameworkIcons.Check size={16} />} className="font-bold text-xs tracking-tight uppercase whitespace-nowrap">{AdminI18n.t('users.verifyEnable')}</Button></div></div></div> : null}

        {twoFactorEnabled ? <div className={`p-6 rounded-xl border ${isDark ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-emerald-50 border-emerald-100'}`}><div className="flex items-start gap-3 mb-4"><FrameworkIcons.ShieldCheck size={20} className="text-emerald-500 mt-0.5" /><div><h4 className="text-sm font-bold text-emerald-600 dark:text-emerald-400 mb-1">{AdminI18n.t('users.protectionActive')}</h4><p className="text-xs text-slate-600 dark:text-slate-400">{AdminI18n.t('users.thisAccountRequiresA6')}</p><p className="text-xs text-slate-600 dark:text-slate-400 mt-1">{AdminI18n.t('users.recoveryCodesRemaining')} <span className="font-bold">{recoveryCodesRemaining}</span></p></div></div><div className="flex items-center gap-2 flex-wrap"><Button onClick={handleRegenerateRecoveryCodes} variant={ButtonVariant.OUTLINE} isLoading={isRegeneratingCodes} className="font-bold text-xs tracking-tight uppercase" icon={<FrameworkIcons.Refresh size={16} />}>{AdminI18n.t('users.regenerateRecoveryCodes')}</Button><Button onClick={handleDisable2FA} variant={ButtonVariant.OUTLINE} className="font-bold text-xs tracking-tight uppercase border-rose-200 bg-rose-50 text-rose-600 hover:border-rose-300 hover:bg-rose-100 dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-300 dark:hover:bg-rose-500/20" icon={<FrameworkIcons.Warning size={16} />}>{AdminI18n.t('users.disable2fa')}</Button></div></div> : null}

        {generatedRecoveryCodes.length > 0 ? <div className={`p-6 ${AdminClass.SURFACE} ${isDark ? 'bg-amber-500/5 border-amber-500/20' : 'bg-amber-50 border-amber-100'}`}><div className="flex items-start justify-between gap-4 mb-4"><div><h4 className="text-sm font-bold text-amber-600 dark:text-amber-400 mb-1">{AdminI18n.t('users.recoveryCodes')}</h4><p className="text-xs text-slate-600 dark:text-slate-400">{AdminI18n.t('users.eachCodeCanBeUsed')}</p></div><Button onClick={copyRecoveryCodes} variant={ButtonVariant.OUTLINE} size={FieldSize.SM} className="text-xs font-bold uppercase">{AdminI18n.t('users.copy')}</Button></div><div className="grid grid-cols-1 sm:grid-cols-2 gap-2">{generatedRecoveryCodes.map((code) => <div key={code} className={`px-3 py-2 rounded-lg font-mono text-sm border ${isDark ? 'bg-slate-900 border-slate-700 text-slate-200' : 'bg-white border-slate-200 text-slate-700'}`}>{code}</div>)}</div></div> : null}
      </div>
    </Card>
  );
  }
}
