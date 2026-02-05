"use client";

import React, { useState } from 'react';
import { useAuth } from '@/components/AuthContext';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { FrameworkIcons } from '@/lib/icons';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { api } from '@/lib/api';
import { ENDPOINTS } from '@/lib/constants';
import { useNotify } from '@/components/NotificationContext';
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
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});

  useEffect(() => {
    // SELF-HEALING: Purge any conflicting cookies on landing to the login page.
    // This resolves the "multiple fc_token" error without requiring user to clear cache.
    purgeAuth();

    async function checkStatus() {
      try {
        const data = await api.get(ENDPOINTS.AUTH.STATUS);
        if (data.initialized === false) {
          router.push('/setup');
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
    notify('info', 'Recovery Disabled', 'Password recovery is not enabled in this environment. Please contact your system administrator.');
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
    
    if (Object.keys(newFieldErrors).length > 0) {
      setFieldErrors(newFieldErrors);
      return;
    }
    
    setFieldErrors({});
    setIsLoading(true);
    
    try {
      const data = await api.post(ENDPOINTS.AUTH.LOGIN, { email, password });
      
      // Redirection is handled inside login() or by the middleware on reload
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
          <div className="h-10 w-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Verifying System...</span>
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
          <h1 className="text-3xl font-black tracking-tight mb-2 text-slate-900 dark:text-white">
            Welcome to {APP_NAME}
          </h1>
          <p className="text-slate-500 font-medium">Please enter your credentials to continue</p>
        </div>

        <div className="p-8 rounded-3xl border shadow-2xl bg-white border-slate-200 dark:bg-[#0f172a] dark:border-slate-800 dark:shadow-black/40">
          {error && (
            <div className="mb-6 p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-500 text-sm font-bold animate-in fade-in zoom-in duration-300">
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
              onChange={(e) => setEmail(e.target.value)}
              error={fieldErrors.email}
              className="group"
            />
            
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-black uppercase tracking-widest text-slate-500">Password</label>
                <button type="button" onClick={handleForgotPassword} className="text-xs font-bold text-indigo-500 hover:text-indigo-400">Forgot?</button>
              </div>
              <Input 
                placeholder="••••••••"
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                error={fieldErrors.password}
              />
            </div>

            <div className="flex items-center justify-between py-2">
              <div className="flex items-center gap-2">
                <div className="p-1 rounded bg-indigo-500/10 text-indigo-500">
                  <FrameworkIcons.Shield size={14} />
                </div>
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Secure Session</span>
              </div>
              <button 
                type="button" 
                onClick={() => router.push('/setup')} 
                className="text-[10px] font-bold text-indigo-500 hover:underline uppercase tracking-widest"
              >
                Initialization Mode
              </button>
            </div>

            <Button 
              type="submit" 
              className="w-full py-4 text-base transform hover:scale-[1.02] active:scale-[0.98]"
              isLoading={isLoading}
            >
              Sign In to Portal
              {!isLoading && <FrameworkIcons.ArrowRight size={18} className="ml-2" />}
            </Button>
          </form>
        </div>

        <p className="text-center mt-8 text-sm text-slate-500">
          Not part of the organization? <button onClick={handleContactSupport} className="font-bold text-indigo-500 hover:text-indigo-400 underline decoration-indigo-500/30 underline-offset-4">Contact Support</button>
        </p>
      </div>
    </div>
  );
}
