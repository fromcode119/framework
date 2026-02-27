"use client";

import React, { useState } from 'react';
import { useAuth } from '@/components/auth-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FrameworkIcons } from '@/lib/icons';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { api } from '@/lib/api';
import { ENDPOINTS, ROUTES } from '@/lib/constants';
import { useNotify } from '@/components/notification-context';
import { APP_NAME } from '@/lib/env';
import { purgeAuth } from '@/lib/auth-utils';

export default function LoginPage() {
  const router = useRouter();
  const { notify } = useNotify();
  const { login } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [isCheckingStatus, setIsCheckingStatus] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [totpToken, setTotpToken] = useState('');
  const [recoveryCode, setRecoveryCode] = useState('');
  const [twoFactorMethod, setTwoFactorMethod] = useState<'totp' | 'recovery'>('totp');
  const [requiresTwoFactor, setRequiresTwoFactor] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string; totpToken?: string; recoveryCode?: string }>({});

  useEffect(() => {
    // SELF-HEALING: Purge any conflicting cookies on landing to the login page.
    // This resolves the "multiple fc_token" error without requiring user to clear cache.
    purgeAuth();

    async function checkStatus() {
      try {
        const data = await api.get(ENDPOINTS.AUTH.STATUS);
        if (data.initialized === false) {
          router.push(ROUTES.AUTH.SETUP);
        }
      } catch (err) {
        console.warn("API health check failed. Defaulting to manual login.", err);
      } finally {
        setIsCheckingStatus(false);
      }
    }
    checkStatus();
  }, [router]);

  const handleForgotPassword = (e: React.FormEvent) => {
    e.preventDefault();
    router.push(ROUTES.AUTH.FORGOT_PASSWORD);
  };

  const handleContactSupport = (e: React.FormEvent) => {
    e.preventDefault();
    notify('info', 'Support Offline', 'Support portal is temporarily unavailable. Please try again later.');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const newFieldErrors: any = {};
    
    if (!email) newFieldErrors.email = 'Required';
    if (!password) newFieldErrors.password = 'Required';
    if (requiresTwoFactor && twoFactorMethod === 'totp' && !totpToken.trim()) newFieldErrors.totpToken = 'Required';
    if (requiresTwoFactor && twoFactorMethod === 'recovery' && !recoveryCode.trim()) newFieldErrors.recoveryCode = 'Required';
    
    if (Object.keys(newFieldErrors).length > 0) {
      setFieldErrors(newFieldErrors);
      return;
    }
    
    setFieldErrors({});
    setIsLoading(true);
    
    try {
      const payload: Record<string, string> = { email, password };
      if (requiresTwoFactor && twoFactorMethod === 'totp' && totpToken.trim()) {
        payload.totpToken = totpToken.trim();
      }
      if (requiresTwoFactor && twoFactorMethod === 'recovery' && recoveryCode.trim()) {
        payload.recoveryCode = recoveryCode.trim();
      }

      const data = await api.post(ENDPOINTS.AUTH.LOGIN, payload);

      if (data?.requiresTwoFactor) {
        setRequiresTwoFactor(true);
        setTwoFactorMethod('totp');
        setError('');
        return;
      }

      if (!data?.token || !data?.user) {
        throw new Error('Login response is missing session data.');
      }

      setRequiresTwoFactor(false);
      setTotpToken('');
      setRecoveryCode('');
      login(data.token, data.user);
    } catch (err: any) {
      setError(err.message || 'Login failed. Please check your credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  if (isCheckingStatus) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-[#020617]">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin text-indigo-600">
             <FrameworkIcons.Loader size={40} />
          </div>
          <span className="text-xs font-semibold text-slate-500 tracking-wide">Verifying...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-slate-50 dark:bg-[#020617]">
      <div className="w-full max-w-md animate-in fade-in slide-in-from-bottom-4 duration-700">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-indigo-600 rounded-2xl shadow-xl shadow-indigo-600/30 mb-6 transform hover:scale-110 transition-transform">
            <FrameworkIcons.Zap size={32} className="text-white" fill="currentColor" />
          </div>
          <h1 className="text-3xl font-semibold tracking-tight mb-2 text-slate-900 dark:text-white">
            Welcome to {APP_NAME}
          </h1>
          <p className="text-slate-500 font-medium">Please enter your credentials to continue</p>
        </div>

        <div className="p-8 rounded-3xl border shadow-2xl bg-white border-slate-200 dark:bg-[#0f172a] dark:border-slate-800 dark:shadow-black/40">
          {error && (
            <div className="mb-6 p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-500 text-sm font-semibold animate-in fade-in zoom-in duration-300">
              {error}
            </div>
          )}
          <form onSubmit={handleSubmit} className="space-y-6" noValidate>
            <Input 
              label="Email Address"
              placeholder="name@company.com"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (requiresTwoFactor) {
                  setRequiresTwoFactor(false);
                  setTotpToken('');
                  setRecoveryCode('');
                  setTwoFactorMethod('totp');
                }
              }}
              error={fieldErrors.email}
              className="group"
            />
            
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Password</label>
                <button type="button" onClick={handleForgotPassword} className="text-xs font-semibold text-indigo-500 hover:text-indigo-400">Forgot?</button>
              </div>
              <Input 
                placeholder="••••••••"
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (requiresTwoFactor) {
                    setRequiresTwoFactor(false);
                    setTotpToken('');
                    setRecoveryCode('');
                    setTwoFactorMethod('totp');
                  }
                }}
                error={fieldErrors.password}
              />
            </div>

            {requiresTwoFactor ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant={twoFactorMethod === 'totp' ? 'primary' : 'outline'}
                    size="sm"
                    className="rounded-lg"
                    onClick={() => setTwoFactorMethod('totp')}
                  >
                    Authenticator Code
                  </Button>
                  <Button
                    type="button"
                    variant={twoFactorMethod === 'recovery' ? 'primary' : 'outline'}
                    size="sm"
                    className="rounded-lg"
                    onClick={() => setTwoFactorMethod('recovery')}
                  >
                    Recovery Code
                  </Button>
                </div>
                {twoFactorMethod === 'totp' ? (
                  <Input
                    label="2FA Code"
                    placeholder="123456"
                    type="text"
                    required
                    autoComplete="one-time-code"
                    value={totpToken}
                    onChange={(e) => setTotpToken(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    error={fieldErrors.totpToken}
                  />
                ) : (
                  <Input
                    label="Recovery Code"
                    placeholder="ABCDE-12345"
                    type="text"
                    required
                    value={recoveryCode}
                    onChange={(e) => setRecoveryCode(e.target.value.toUpperCase())}
                    error={fieldErrors.recoveryCode}
                  />
                )}
              </div>
            ) : null}

            <div className="flex items-center justify-between py-2">
              <div className="flex items-center gap-2">
                <div className="p-1 rounded bg-indigo-500/10 text-indigo-500">
                  <FrameworkIcons.Shield size={14} />
                </div>
                <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Secure Session</span>
              </div>
            </div>

            <Button 
              type="submit" 
              className="w-full py-4 text-base transform hover:scale-[1.02] active:scale-[0.98]"
              isLoading={isLoading}
            >
              {requiresTwoFactor
                ? (twoFactorMethod === 'totp' ? 'Verify 2FA & Sign In' : 'Use Recovery Code & Sign In')
                : 'Sign In to Portal'}
              {!isLoading && <FrameworkIcons.ArrowRight size={18} className="ml-2" />}
            </Button>
          </form>
        </div>

        <p className="text-center mt-8 text-sm text-slate-500">
          Not part of the organization? <button onClick={handleContactSupport} className="font-semibold text-indigo-500 hover:text-indigo-400 underline decoration-indigo-500/30 underline-offset-4">Contact Support</button>
        </p>
      </div>
    </div>
  );
}
