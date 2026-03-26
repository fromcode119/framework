"use client";

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FrameworkIcons } from '@/lib/icons';

export default function TwoFactorSecurityCard({
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
}: {
  copyRecoveryCodes: () => Promise<void>;
  generatedRecoveryCodes: string[];
  handleDisable2FA: () => Promise<void>;
  handleEnable2FA: () => Promise<void>;
  handleRegenerateRecoveryCodes: () => Promise<void>;
  handleVerify2FA: () => Promise<void>;
  isDark: boolean;
  isEnabling: boolean;
  isRegeneratingCodes: boolean;
  isVerifying: boolean;
  qrCode: string | null;
  recoveryCodesRemaining: number;
  secret: string | null;
  setVerificationCode: (value: string) => void;
  twoFactorEnabled: boolean;
  verificationCode: string;
}) {
  return (
    <Card title="Two-Factor Authentication" icon={<FrameworkIcons.ShieldCheck size={20} className="text-indigo-500" />}>
      <div className="space-y-6">
        <div className="flex items-center justify-between py-4">
          <div className="space-y-1"><h3 className={`font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>2FA Status</h3><p className="text-xs text-slate-500">Add an extra layer of security using app-based authentication (TOTP)</p></div>
          <div className="flex items-center gap-3">{twoFactorEnabled ? <div className="flex items-center gap-2"><div className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]" /><span className="text-xs font-bold text-emerald-500">ENABLED</span></div> : <div className="flex items-center gap-2"><div className="h-2 w-2 rounded-full bg-rose-500" /><span className="text-xs font-bold text-slate-500">DISABLED</span></div>}</div>
        </div>

        {!twoFactorEnabled && !qrCode ? <div className={`p-6 rounded-2xl border ${isDark ? 'bg-indigo-500/5 border-indigo-500/20' : 'bg-indigo-50 border-indigo-100'}`}><h4 className="text-xs font-bold text-indigo-500 mb-2 uppercase tracking-wide">Recommended</h4><p className="text-sm text-slate-600 dark:text-slate-300 mb-4">Enable two-factor authentication to protect this account with time-based one-time passwords (TOTP).</p><Button onClick={handleEnable2FA} isLoading={isEnabling} icon={<FrameworkIcons.ShieldCheck size={16} />} className="font-bold text-xs tracking-tight uppercase">Enable 2FA</Button></div> : null}

        {qrCode && !twoFactorEnabled ? <div className="space-y-6"><div className={`p-6 rounded-2xl border ${isDark ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-200'}`}><h4 className="text-xs font-bold text-slate-500 mb-4 uppercase tracking-wide">Step 1: Scan QR Code</h4><p className="text-sm text-slate-600 dark:text-slate-300 mb-4">Use an authenticator app like Google Authenticator, Authy, or 1Password to scan this QR code:</p><div className="flex justify-center py-4"><img src={qrCode} alt="2FA QR Code" className="border-4 border-white dark:border-slate-700 rounded-2xl shadow-xl" /></div>{secret ? <div className="mt-4"><p className="text-xs text-slate-500 mb-2 font-bold uppercase tracking-wide">Manual Entry Code:</p><div className={`p-3 rounded-xl font-mono text-sm ${isDark ? 'bg-slate-900 text-slate-300' : 'bg-white text-slate-700'} border ${isDark ? 'border-slate-700' : 'border-slate-200'}`}>{secret}</div></div> : null}</div><div className={`p-6 rounded-2xl border ${isDark ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-200'}`}><h4 className="text-xs font-bold text-slate-500 mb-4 uppercase tracking-wide">Step 2: Verify Code</h4><p className="text-sm text-slate-600 dark:text-slate-300 mb-4">Enter the 6-digit code from your authenticator app to complete setup:</p><div className="flex gap-3"><Input type="text" placeholder="000000" maxLength={6} value={verificationCode} onChange={(event) => setVerificationCode(event.target.value)} className="font-mono text-lg text-center tracking-widest" /><Button onClick={handleVerify2FA} isLoading={isVerifying} disabled={verificationCode.length !== 6} icon={<FrameworkIcons.Check size={16} />} className="font-bold text-xs tracking-tight uppercase whitespace-nowrap">Verify & Enable</Button></div></div></div> : null}

        {twoFactorEnabled ? <div className={`p-6 rounded-2xl border ${isDark ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-emerald-50 border-emerald-100'}`}><div className="flex items-start gap-3 mb-4"><FrameworkIcons.ShieldCheck size={20} className="text-emerald-500 mt-0.5" /><div><h4 className="text-sm font-bold text-emerald-600 dark:text-emerald-400 mb-1">Protection Active</h4><p className="text-xs text-slate-600 dark:text-slate-400">This account requires a 6-digit code from an authenticator app at login.</p><p className="text-xs text-slate-600 dark:text-slate-400 mt-1">Recovery codes remaining: <span className="font-bold">{recoveryCodesRemaining}</span></p></div></div><div className="flex items-center gap-2 flex-wrap"><Button onClick={handleRegenerateRecoveryCodes} variant="outline" isLoading={isRegeneratingCodes} className="font-bold text-xs tracking-tight uppercase" icon={<FrameworkIcons.Refresh size={16} />}>Regenerate Recovery Codes</Button><Button onClick={handleDisable2FA} variant="outline" className="font-bold text-xs tracking-tight uppercase border-rose-200 bg-rose-50 text-rose-600 hover:border-rose-300 hover:bg-rose-100 dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-300 dark:hover:bg-rose-500/20" icon={<FrameworkIcons.Warning size={16} />}>Disable 2FA</Button></div></div> : null}

        {generatedRecoveryCodes.length > 0 ? <div className={`p-6 rounded-2xl border ${isDark ? 'bg-amber-500/5 border-amber-500/20' : 'bg-amber-50 border-amber-100'}`}><div className="flex items-start justify-between gap-4 mb-4"><div><h4 className="text-sm font-bold text-amber-600 dark:text-amber-400 mb-1">Recovery Codes</h4><p className="text-xs text-slate-600 dark:text-slate-400">Each code can be used once. Save them in a secure password manager.</p></div><Button onClick={copyRecoveryCodes} variant="outline" size="sm" className="text-xs font-bold uppercase">Copy</Button></div><div className="grid grid-cols-1 sm:grid-cols-2 gap-2">{generatedRecoveryCodes.map((code) => <div key={code} className={`px-3 py-2 rounded-lg font-mono text-sm border ${isDark ? 'bg-slate-900 border-slate-700 text-slate-200' : 'bg-white border-slate-200 text-slate-700'}`}>{code}</div>)}</div></div> : null}
      </div>
    </Card>
  );
}
