"use client";

import React, { useState, useEffect } from 'react';
import { ThemeHooks } from '@/components/use-theme';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AdminApi } from '@/lib/api';
import { AdminConstants } from '@/lib/constants';
import { FrameworkIcons } from '@/lib/icons';
import { Loader } from '@/components/ui/loader';
import { NotificationHooks } from '@/components/use-notification';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { AuthHooks } from '@/components/use-auth';

export default function UserSecurityPage() {
  const router = useRouter();
  const { theme } = ThemeHooks.useTheme();
  const { id } = useParams();
  const { user: authUser } = AuthHooks.useAuth();
  const { addNotification } = NotificationHooks.useNotification();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [verificationCode, setVerificationCode] = useState('');
  const [isEnabling, setIsEnabling] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isRegeneratingCodes, setIsRegeneratingCodes] = useState(false);
  const [recoveryCodesRemaining, setRecoveryCodesRemaining] = useState(0);
  const [generatedRecoveryCodes, setGeneratedRecoveryCodes] = useState<string[]>([]);
  const [authActivity, setAuthActivity] = useState<any[]>([]);
  const [authActivityLoading, setAuthActivityLoading] = useState(false);
  const [mySessions, setMySessions] = useState<any[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [myApiTokens, setMyApiTokens] = useState<any[]>([]);
  const [tokensLoading, setTokensLoading] = useState(false);
  const [tokenName, setTokenName] = useState('');
  const [tokenDays, setTokenDays] = useState('30');
  const [createdToken, setCreatedToken] = useState('');

  const isSelf = String(authUser?.id || '') === String(id || '');

  useEffect(() => {
    fetchUserSecurity();
  }, [id]);

  useEffect(() => {
    if (isSelf) {
      fetchMySessions();
      fetchMyApiTokens();
    }
  }, [isSelf]);

  const fetchAuthActivity = async (email: string) => {
    const normalizedEmail = String(email || '').trim().toLowerCase();
    if (!normalizedEmail) {
      setAuthActivity([]);
      return;
    }

    setAuthActivityLoading(true);
    try {
      const response = await AdminApi.get(
        `${AdminConstants.ENDPOINTS.SYSTEM.LOGS}?page=1&limit=25&search=${encodeURIComponent(normalizedEmail)}`
      );
      const docs = Array.isArray(response?.docs)
        ? response.docs
        : Array.isArray(response)
          ? response
          : [];

      const filtered = docs.filter((row: any) => {
        const message = String(row?.message || '').toLowerCase();
        const contextEmail = String(row?.context?.email || row?.email || '').toLowerCase();
        const combined = `${message} ${contextEmail}`;
        return (
          combined.includes(normalizedEmail) &&
          (
            combined.includes('login') ||
            combined.includes('logout') ||
            combined.includes('2fa') ||
            combined.includes('session') ||
            combined.includes('registered')
          )
        );
      });

      setAuthActivity(filtered);
    } catch (err) {
      console.error('Failed to fetch auth activity:', err);
      setAuthActivity([]);
    } finally {
      setAuthActivityLoading(false);
    }
  };

  const fetchUserSecurity = async () => {
    try {
      const userData = await AdminApi.get(AdminConstants.ENDPOINTS.SYSTEM.USER(id as string));
      setUser(userData);

      const [twoFactorStatus] = await Promise.all([
        AdminApi.get(AdminConstants.ENDPOINTS.SYSTEM.USER_2FA_STATUS(id as string)),
        fetchAuthActivity(userData?.email || '')
      ]);

      setTwoFactorEnabled(twoFactorStatus.enabled || false);
      setRecoveryCodesRemaining(Number(twoFactorStatus.recoveryCodesRemaining || 0));
    } catch (err) {
      console.error('Failed to fetch user security:', err);
      addNotification({ title: 'Error', message: 'Failed to load security settings', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const fetchMySessions = async () => {
    if (!isSelf) return;
    setSessionsLoading(true);
    try {
      const response = await AdminApi.get(AdminConstants.ENDPOINTS.AUTH.MY_SESSIONS);
      const docs = Array.isArray(response?.docs) ? response.docs : [];
      setMySessions(docs);
    } catch (err) {
      console.error('Failed to fetch sessions:', err);
      setMySessions([]);
    } finally {
      setSessionsLoading(false);
    }
  };

  const revokeSession = async (sessionId: string) => {
    try {
      const result = await AdminApi.post(AdminConstants.ENDPOINTS.AUTH.REVOKE_MY_SESSION(sessionId), {});
      addNotification({ title: 'Session Revoked', message: 'Device session revoked successfully.', type: 'success' });
      if (result?.revokedCurrent) {
        router.push(AdminConstants.ROUTES.AUTH.LOGIN);
        return;
      }
      await fetchMySessions();
    } catch (err: any) {
      addNotification({ title: 'Error', message: err?.message || 'Failed to revoke session', type: 'error' });
    }
  };

  const revokeOtherSessions = async () => {
    try {
      await AdminApi.post(AdminConstants.ENDPOINTS.AUTH.REVOKE_OTHER_SESSIONS, {});
      addNotification({ title: 'Done', message: 'Other sessions revoked.', type: 'success' });
      await fetchMySessions();
    } catch (err: any) {
      addNotification({ title: 'Error', message: err?.message || 'Failed to revoke other sessions', type: 'error' });
    }
  };

  const fetchMyApiTokens = async () => {
    if (!isSelf) return;
    setTokensLoading(true);
    try {
      const response = await AdminApi.get(AdminConstants.ENDPOINTS.AUTH.API_TOKENS);
      const docs = Array.isArray(response?.docs) ? response.docs : [];
      setMyApiTokens(docs);
    } catch (err) {
      console.error('Failed to fetch API tokens:', err);
      setMyApiTokens([]);
    } finally {
      setTokensLoading(false);
    }
  };

  const createApiToken = async () => {
    try {
      if (!tokenName.trim()) {
        addNotification({ title: 'Name Required', message: 'Enter a token name first.', type: 'error' });
        return;
      }
      const expiresInDays = Number.parseInt(String(tokenDays || '').trim(), 10);
      const payload: any = { name: tokenName.trim() };
      if (!Number.isNaN(expiresInDays)) payload.expiresInDays = expiresInDays;
      const response = await AdminApi.post(AdminConstants.ENDPOINTS.AUTH.API_TOKENS, payload);
      const rawToken = String(response?.token || '');
      setCreatedToken(rawToken);
      setTokenName('');
      addNotification({ title: 'Token Created', message: 'Copy the token now. It is shown once.', type: 'success' });
      await fetchMyApiTokens();
    } catch (err: any) {
      addNotification({ title: 'Error', message: err?.message || 'Failed to create API token', type: 'error' });
    }
  };

  const revokeApiToken = async (tokenId: string) => {
    try {
      await AdminApi.delete(AdminConstants.ENDPOINTS.AUTH.API_TOKEN(tokenId));
      addNotification({ title: 'Token Revoked', message: 'API token revoked successfully.', type: 'success' });
      await fetchMyApiTokens();
    } catch (err: any) {
      addNotification({ title: 'Error', message: err?.message || 'Failed to revoke API token', type: 'error' });
    }
  };

  const handleEnable2FA = async () => {
    setIsEnabling(true);
    try {
      const response = await AdminApi.post(AdminConstants.ENDPOINTS.SYSTEM.USER_2FA_SETUP(id as string), {});
      setQrCode(response.qrCode);
      setSecret(response.secret);
      addNotification({ title: 'Setup Started', message: 'Scan the QR code with your authenticator app', type: 'info' });
    } catch (err: any) {
      addNotification({ title: 'Setup Failed', message: err.message || 'Failed to generate 2FA setup', type: 'error' });
    } finally {
      setIsEnabling(false);
    }
  };

  const handleVerify2FA = async () => {
    if (!verificationCode || verificationCode.length !== 6) {
      addNotification({ title: 'Invalid Code', message: 'Please enter a 6-digit verification code', type: 'error' });
      return;
    }

    setIsVerifying(true);
    try {
      const verifyResponse = await AdminApi.post(AdminConstants.ENDPOINTS.SYSTEM.USER_2FA_VERIFY(id as string), { token: verificationCode });
      setTwoFactorEnabled(true);
      setQrCode(null);
      setSecret(null);
      setVerificationCode('');
      const recoveryCodes = Array.isArray(verifyResponse?.recoveryCodes) ? verifyResponse.recoveryCodes : [];
      setGeneratedRecoveryCodes(recoveryCodes);
      setRecoveryCodesRemaining(recoveryCodes.length);
      addNotification({ title: '2FA Enabled', message: 'Two-factor authentication is now active', type: 'success' });
    } catch (err: any) {
      addNotification({ title: 'Verification Failed', message: err.message || 'Invalid verification code', type: 'error' });
    } finally {
      setIsVerifying(false);
    }
  };

  const handleDisable2FA = async () => {
    if (!confirm('Are you sure you want to disable 2FA for this user? This will reduce account security.')) {
      return;
    }

    try {
      await AdminApi.delete(AdminConstants.ENDPOINTS.SYSTEM.USER_2FA(id as string));
      setTwoFactorEnabled(false);
      setQrCode(null);
      setSecret(null);
      setGeneratedRecoveryCodes([]);
      setRecoveryCodesRemaining(0);
      addNotification({ title: '2FA Disabled', message: 'Two-factor authentication has been removed', type: 'info' });
    } catch (err: any) {
      addNotification({ title: 'Error', message: err.message || 'Failed to disable 2FA', type: 'error' });
    }
  };

  const copyRecoveryCodes = async () => {
    if (!generatedRecoveryCodes.length) return;
    try {
      await navigator.clipboard.writeText(generatedRecoveryCodes.join('\n'));
      addNotification({ title: 'Copied', message: 'Recovery codes copied to clipboard.', type: 'success' });
    } catch {
      addNotification({ title: 'Copy Failed', message: 'Please copy the recovery codes manually.', type: 'error' });
    }
  };

  const handleRegenerateRecoveryCodes = async () => {
    if (!confirm('Regenerate recovery codes? Existing unused codes will stop working immediately.')) {
      return;
    }
    setIsRegeneratingCodes(true);
    try {
      const response = await AdminApi.post(AdminConstants.ENDPOINTS.SYSTEM.USER_2FA_RECOVERY_REGENERATE(id as string), {});
      const codes = Array.isArray(response?.recoveryCodes) ? response.recoveryCodes : [];
      setGeneratedRecoveryCodes(codes);
      setRecoveryCodesRemaining(codes.length);
      addNotification({ title: 'Recovery Codes Regenerated', message: 'Save the new codes now. Old codes are invalid.', type: 'success' });
    } catch (err: any) {
      addNotification({ title: 'Regeneration Failed', message: err.message || 'Unable to regenerate recovery codes.', type: 'error' });
    } finally {
      setIsRegeneratingCodes(false);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-screen">
        <Loader label="Loading Security Settings..." />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-screen space-y-4">
        <h1 className="text-2xl font-semibold text-slate-400 tracking-tight">User Not Found</h1>
        <Link href="/users">
          <Button variant="ghost">Return to Users</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="w-full min-h-screen flex flex-col animate-in fade-in duration-500">
      <div className={`sticky top-0 z-40 border-b backdrop-blur-3xl ${
        theme === 'dark' ? 'bg-slate-950/80 border-slate-800/50 shadow-2xl' : 'bg-white/80 border-slate-100 shadow-sm'
      }`}>
        <div className="w-full px-6 lg:px-12 py-8 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link href={`/users/${id}`} className={`p-2 rounded-xl transition-all ${theme === 'dark' ? 'hover:bg-slate-800 text-slate-500' : 'hover:bg-slate-50 text-slate-400'}`}>
              <FrameworkIcons.Left size={20} />
            </Link>
            <div>
              <h1 className={`text-2xl font-bold tracking-tight ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                Security & Two-Factor Authentication
              </h1>
              <div className="flex items-center gap-4 mt-1">
                <span className="text-[10px] font-bold tracking-tight text-slate-500">{user.email}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 w-full max-w-3xl mx-auto px-6 py-12 space-y-8">
        <Card title="Two-Factor Authentication" icon={<FrameworkIcons.ShieldCheck size={20} className="text-indigo-500" />}>
          <div className="space-y-6">
            <div className="flex items-center justify-between py-4">
              <div className="space-y-1">
                <h3 className={`font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>2FA Status</h3>
                <p className="text-xs text-slate-500">Add an extra layer of security using app-based authentication (TOTP)</p>
              </div>
              <div className="flex items-center gap-3">
                {twoFactorEnabled ? (
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]" />
                    <span className="text-xs font-bold text-emerald-500">ENABLED</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-rose-500" />
                    <span className="text-xs font-bold text-slate-500">DISABLED</span>
                  </div>
                )}
              </div>
            </div>

            {!twoFactorEnabled && !qrCode && (
              <div className={`p-6 rounded-2xl border ${theme === 'dark' ? 'bg-indigo-500/5 border-indigo-500/20' : 'bg-indigo-50 border-indigo-100'}`}>
                <h4 className="text-xs font-bold text-indigo-500 mb-2 uppercase tracking-wide">Recommended</h4>
                <p className="text-sm text-slate-600 dark:text-slate-300 mb-4">
                  Enable two-factor authentication to protect this account with time-based one-time passwords (TOTP).
                </p>
                <Button
                  onClick={handleEnable2FA}
                  isLoading={isEnabling}
                  icon={<FrameworkIcons.ShieldCheck size={16} />}
                  className="font-bold text-xs tracking-tight uppercase"
                >
                  Enable 2FA
                </Button>
              </div>
            )}

            {qrCode && !twoFactorEnabled && (
              <div className="space-y-6">
                <div className={`p-6 rounded-2xl border ${theme === 'dark' ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                  <h4 className="text-xs font-bold text-slate-500 mb-4 uppercase tracking-wide">Step 1: Scan QR Code</h4>
                  <p className="text-sm text-slate-600 dark:text-slate-300 mb-4">
                    Use an authenticator app like Google Authenticator, Authy, or 1Password to scan this QR code:
                  </p>
                  <div className="flex justify-center py-4">
                    <img src={qrCode} alt="2FA QR Code" className="border-4 border-white dark:border-slate-700 rounded-2xl shadow-xl" />
                  </div>
                  {secret && (
                    <div className="mt-4">
                      <p className="text-xs text-slate-500 mb-2 font-bold uppercase tracking-wide">Manual Entry Code:</p>
                      <div className={`p-3 rounded-xl font-mono text-sm ${theme === 'dark' ? 'bg-slate-900 text-slate-300' : 'bg-white text-slate-700'} border ${theme === 'dark' ? 'border-slate-700' : 'border-slate-200'}`}>
                        {secret}
                      </div>
                    </div>
                  )}
                </div>

                <div className={`p-6 rounded-2xl border ${theme === 'dark' ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                  <h4 className="text-xs font-bold text-slate-500 mb-4 uppercase tracking-wide">Step 2: Verify Code</h4>
                  <p className="text-sm text-slate-600 dark:text-slate-300 mb-4">
                    Enter the 6-digit code from your authenticator app to complete setup:
                  </p>
                  <div className="flex gap-3">
                    <Input
                      type="text"
                      placeholder="000000"
                      maxLength={6}
                      value={verificationCode}
                      onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, ''))}
                      className="font-mono text-lg text-center tracking-widest"
                    />
                    <Button
                      onClick={handleVerify2FA}
                      isLoading={isVerifying}
                      disabled={verificationCode.length !== 6}
                      icon={<FrameworkIcons.Check size={16} />}
                      className="font-bold text-xs tracking-tight uppercase whitespace-nowrap"
                    >
                      Verify & Enable
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {twoFactorEnabled && (
              <div className={`p-6 rounded-2xl border ${theme === 'dark' ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-emerald-50 border-emerald-100'}`}>
                <div className="flex items-start gap-3 mb-4">
                  <FrameworkIcons.ShieldCheck size={20} className="text-emerald-500 mt-0.5" />
                  <div>
                    <h4 className="text-sm font-bold text-emerald-600 dark:text-emerald-400 mb-1">Protection Active</h4>
                    <p className="text-xs text-slate-600 dark:text-slate-400">
                      This account requires a 6-digit code from an authenticator app at login.
                    </p>
                    <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                      Recovery codes remaining: <span className="font-bold">{recoveryCodesRemaining}</span>
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <Button
                    onClick={handleRegenerateRecoveryCodes}
                    variant="outline"
                    isLoading={isRegeneratingCodes}
                    className="font-bold text-xs tracking-tight uppercase"
                    icon={<FrameworkIcons.Refresh size={16} />}
                  >
                    Regenerate Recovery Codes
                  </Button>
                  <Button
                    onClick={handleDisable2FA}
                    variant="outline"
                    className="font-bold text-xs tracking-tight uppercase border-rose-200 bg-rose-50 text-rose-600 hover:border-rose-300 hover:bg-rose-100 dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-300 dark:hover:bg-rose-500/20"
                    icon={<FrameworkIcons.Warning size={16} />}
                  >
                    Disable 2FA
                  </Button>
                </div>
              </div>
            )}

            {generatedRecoveryCodes.length > 0 && (
              <div className={`p-6 rounded-2xl border ${theme === 'dark' ? 'bg-amber-500/5 border-amber-500/20' : 'bg-amber-50 border-amber-100'}`}>
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div>
                    <h4 className="text-sm font-bold text-amber-600 dark:text-amber-400 mb-1">Recovery Codes</h4>
                    <p className="text-xs text-slate-600 dark:text-slate-400">
                      Each code can be used once. Save them in a secure password manager.
                    </p>
                  </div>
                  <Button
                    onClick={copyRecoveryCodes}
                    variant="outline"
                    size="sm"
                    className="text-xs font-bold uppercase"
                  >
                    Copy
                  </Button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {generatedRecoveryCodes.map((code) => (
                    <div
                      key={code}
                      className={`px-3 py-2 rounded-lg font-mono text-sm border ${
                        theme === 'dark' ? 'bg-slate-900 border-slate-700 text-slate-200' : 'bg-white border-slate-200 text-slate-700'
                      }`}
                    >
                      {code}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </Card>

        <Card title="Security Recommendations" icon={<FrameworkIcons.Shield size={18} className="text-amber-500" />}>
          <div className="space-y-4 py-2">
            <div className="flex items-start gap-3">
              <div className={`h-8 w-8 rounded-xl flex items-center justify-center ${twoFactorEnabled ? 'bg-emerald-500/10 text-emerald-500' : 'bg-slate-500/10 text-slate-500'}`}>
                <FrameworkIcons.ShieldCheck size={16} />
              </div>
              <div className="flex-1">
                <h4 className={`text-sm font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>Two-Factor Authentication</h4>
                <p className="text-xs text-slate-500 mt-1">
                  {twoFactorEnabled ? 'Active and protecting this account' : 'Not enabled - highly recommended for admin accounts'}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="h-8 w-8 rounded-xl flex items-center justify-center bg-emerald-500/10 text-emerald-500">
                <FrameworkIcons.Check size={16} />
              </div>
              <div className="flex-1">
                <h4 className={`text-sm font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>Password Protected</h4>
                <p className="text-xs text-slate-500 mt-1">Account has a secure password</p>
              </div>
            </div>
            {user.roles?.includes('admin') && (
              <div className="flex items-start gap-3">
                <div className="h-8 w-8 rounded-xl flex items-center justify-center bg-indigo-500/10 text-indigo-500">
                  <FrameworkIcons.Shield size={16} />
                </div>
                <div className="flex-1">
                  <h4 className={`text-sm font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>Administrator Access</h4>
                  <p className="text-xs text-slate-500 mt-1">Full system access - 2FA strongly recommended</p>
                </div>
              </div>
            )}
          </div>
        </Card>

        {isSelf ? (
          <>
            <Card title="Device Sessions" icon={<FrameworkIcons.Activity size={18} className="text-indigo-500" />}>
              <div className="space-y-3">
                <div className="flex items-center justify-end">
                  <Button variant="outline" className="font-bold text-xs tracking-tight uppercase" onClick={revokeOtherSessions}>
                    Revoke Other Sessions
                  </Button>
                </div>
                {sessionsLoading ? (
                  <Loader label="Loading sessions..." />
                ) : mySessions.length === 0 ? (
                  <div className="text-xs font-bold uppercase tracking-tight text-slate-400 py-3">No active sessions.</div>
                ) : (
                  mySessions.map((session: any) => (
                    <div key={String(session.id)} className={`p-3 rounded-xl border ${theme === 'dark' ? 'border-slate-800 bg-slate-900/40' : 'border-slate-200 bg-white'}`}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
                              {session.isCurrent ? 'Current Session' : 'Device Session'}
                            </span>
                            {session.isCurrent ? <span className="text-[10px] font-bold uppercase tracking-tight text-emerald-500">Current</span> : null}
                          </div>
                          <p className="text-[11px] font-semibold text-slate-500 break-all">
                            {String(session.userAgent || 'Unknown device')}
                          </p>
                          <p className="text-[10px] font-bold uppercase tracking-tight text-slate-400">
                            IP: {String(session.ipAddress || 'unknown')} • Expires: {session.expiresAt ? new Date(session.expiresAt).toLocaleString() : 'n/a'}
                          </p>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-[10px] font-bold uppercase tracking-tight"
                          onClick={() => revokeSession(String(session.id))}
                        >
                          Revoke
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </Card>

            <Card title="Personal API Tokens" icon={<FrameworkIcons.Key size={18} className="text-indigo-500" />}>
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                  <div className="md:col-span-5">
                    <Input placeholder="Token name (e.g. CI deploy)" value={tokenName} onChange={(e) => setTokenName(e.target.value)} />
                  </div>
                  <div className="md:col-span-3">
                    <Input type="number" min={1} max={3650} placeholder="Days" value={tokenDays} onChange={(e) => setTokenDays(e.target.value)} />
                  </div>
                  <div className="md:col-span-4">
                    <Button className="w-full font-bold text-xs tracking-tight uppercase" onClick={createApiToken}>
                      Create Token
                    </Button>
                  </div>
                </div>

                {createdToken ? (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
                    <p className="text-[10px] font-bold uppercase tracking-tight text-amber-600 mb-2">Copy Now (shown once)</p>
                    <code className="text-[11px] break-all font-mono text-amber-800">{createdToken}</code>
                  </div>
                ) : null}

                {tokensLoading ? (
                  <Loader label="Loading API tokens..." />
                ) : myApiTokens.length === 0 ? (
                  <div className="text-xs font-bold uppercase tracking-tight text-slate-400 py-2">No API tokens created yet.</div>
                ) : (
                  <div className="space-y-2">
                    {myApiTokens.map((token: any) => (
                      <div key={String(token.id)} className={`p-3 rounded-xl border ${theme === 'dark' ? 'border-slate-800 bg-slate-900/40' : 'border-slate-200 bg-white'}`}>
                        <div className="flex items-center justify-between gap-3">
                          <div className="space-y-1">
                            <p className="text-xs font-bold text-slate-700 dark:text-slate-200">{String(token.name || 'Token')}</p>
                            <p className="text-[10px] font-bold uppercase tracking-tight text-slate-400">
                              {String(token.prefix || 'fct_***')} • Created {token.createdAt ? new Date(token.createdAt).toLocaleDateString() : 'n/a'}
                            </p>
                            {token.revokedAt ? (
                              <p className="text-[10px] font-bold uppercase tracking-tight text-rose-500">
                                Revoked {new Date(token.revokedAt).toLocaleString()}
                              </p>
                            ) : null}
                          </div>
                          {!token.revokedAt ? (
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-[10px] font-bold uppercase tracking-tight"
                              onClick={() => revokeApiToken(String(token.id))}
                            >
                              Revoke
                            </Button>
                          ) : null}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </Card>
          </>
        ) : (
          <Card title="Self-Service Security Controls" icon={<FrameworkIcons.Key size={18} className="text-indigo-500" />}>
            <div className="text-xs font-bold uppercase tracking-tight text-slate-400">
              Session/device controls and personal API tokens are available only when viewing your own user account.
            </div>
          </Card>
        )}

        <div id="auth-activity">
          <Card title="Login & Session Activity" icon={<FrameworkIcons.Activity size={18} className="text-indigo-500" />}>
            <div className="space-y-3">
              {authActivityLoading ? (
                <div className="py-4">
                  <Loader label="Loading auth activity..." />
                </div>
              ) : authActivity.length === 0 ? (
                <div className="text-xs font-bold uppercase tracking-tight text-slate-400 py-4">
                  No recent login/session events for this user.
                </div>
              ) : (
                authActivity.slice(0, 12).map((entry: any, index: number) => {
                  const ts = entry?.timestamp || entry?.createdAt;
                  const level = String(entry?.level || '').toUpperCase();
                  const levelClass =
                    level === 'ERROR'
                      ? 'bg-rose-50 border-rose-100 text-rose-700 dark:bg-rose-500/10 dark:border-rose-500/20 dark:text-rose-300'
                      : level === 'WARN'
                        ? 'bg-amber-50 border-amber-100 text-amber-700 dark:bg-amber-500/10 dark:border-amber-500/20 dark:text-amber-300'
                        : 'bg-emerald-50 border-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:border-emerald-500/20 dark:text-emerald-300';

                  return (
                    <div
                      key={entry?.id || `${index}-${ts || ''}`}
                      className={`p-3 rounded-xl border ${theme === 'dark' ? 'border-slate-800 bg-slate-900/40' : 'border-slate-200 bg-white'}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <span className={`px-2 py-1 rounded-lg border text-[10px] font-bold uppercase tracking-tight ${levelClass}`}>
                          {level || 'INFO'}
                        </span>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">
                          {ts ? new Date(ts).toLocaleString() : 'Unknown Time'}
                        </span>
                      </div>
                      <p className="text-xs font-semibold text-slate-600 dark:text-slate-200 mt-2">
                        {entry?.message || 'Activity event'}
                      </p>
                    </div>
                  );
                })
              )}

              <div className="pt-2">
                <Link href={`/activity?mode=system&user=${encodeURIComponent(String(user?.email || ''))}`}>
                  <Button variant="ghost" className="font-bold text-xs tracking-tight uppercase">
                    Open Full Global Activity
                  </Button>
                </Link>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
