"use client";

import React, { useState, useEffect } from 'react';
import { AuthHooks } from '@/components/use-auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FrameworkIcons } from '@/lib/icons';
import { useRouter } from 'next/navigation';
import { AdminApi } from '@/lib/api';
import { AdminConstants } from '@/lib/constants';
import { AppEnv } from '@/lib/env';

const { Zap, Mail, Lock, ArrowRight, Shield: ShieldCheck, UserPlus, Orbit } = FrameworkIcons;

const ICON_SIZE = 42;

export default function SetupPage() {
  const router = useRouter();
  const { login } = AuthHooks.useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string; confirmPassword?: string }>({});

  useEffect(() => {
    async function checkStatus() {
      try {
        const data = await AdminApi.get(AdminConstants.ENDPOINTS.AUTH.STATUS);
        if (data.initialized === true) {
          router.push(AdminConstants.ROUTES.AUTH.LOGIN);
        }
      } catch (err) {
        console.warn("API check failed in setup:", err);
      } finally {
        setIsChecking(false);
      }
    }
    checkStatus();
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const newFieldErrors: any = {};
    
    if (!email) newFieldErrors.email = 'Required';
    if (!password) newFieldErrors.password = 'Required';
    if (!confirmPassword) newFieldErrors.confirmPassword = 'Required';
    
    if (password && confirmPassword && password !== confirmPassword) {
      newFieldErrors.confirmPassword = 'Passwords do not match';
    }

    if (password && password.length < 6) {
      newFieldErrors.password = 'Min 6 characters';
    }
    
    if (Object.keys(newFieldErrors).length > 0) {
      setFieldErrors(newFieldErrors);
      return;
    }
    
    setFieldErrors({});
    setIsLoading(true);
    
    try {
      const data = await AdminApi.post(AdminConstants.ENDPOINTS.AUTH.SETUP, { email, password });
      login(data.token, data.user);
    } catch (err: any) {
      setError(err.message || 'Setup failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  if (isChecking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="flex flex-col items-center gap-6">
          <div className="animate-spin text-indigo-600">
            <FrameworkIcons.Loader size={48} />
          </div>
          <span className="text-[11px] font-semibold text-indigo-500 tracking-wide">Initializing...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 sm:p-6 bg-slate-50 dark:bg-[#020617]">
      <div className="w-full max-w-md">
        <div className="text-center mb-6 animate-in fade-in slide-in-from-top-4 duration-1000">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-white dark:bg-slate-900 rounded-3xl shadow-[0_12px_28px_rgba(79,70,229,0.12)] dark:shadow-[0_12px_28px_rgba(0,0,0,0.45)] mb-4 transform hover:scale-105 transition-all duration-500 border-2 border-white dark:border-slate-800 outline outline-1 outline-indigo-50/50 dark:outline-slate-800">
            <FrameworkIcons.Orbit size={ICON_SIZE} className="text-indigo-600 dark:text-indigo-500 animate-[spin_10s_linear_infinite]" />
          </div>
          <h1 className="text-3xl font-semibold tracking-tight mb-2 text-slate-950 dark:text-white">
            System Setup
          </h1>
          <p className="text-slate-500 font-medium text-sm leading-relaxed max-w-[340px] mx-auto">Create the root administrator account to unlock your digital core.</p>
        </div>

        <div className="p-6 sm:p-7 rounded-3xl border shadow-[0_20px_40px_-12px_rgba(0,0,0,0.14)] dark:shadow-black/50 animate-in fade-in slide-in-from-bottom-8 duration-1000 bg-white dark:bg-slate-900/50 border-slate-100 dark:border-slate-800">
          {error && (
            <div className="mb-5 p-4 rounded-2xl bg-rose-50 border border-rose-100 dark:bg-rose-500/10 dark:border-rose-500/20 text-rose-600 text-[12px] font-semibold animate-in zoom-in duration-300 flex items-center gap-3">
              <div className="flex-shrink-0 h-8 w-8 rounded-xl bg-rose-100 dark:bg-rose-500/20 flex items-center justify-center">
                <FrameworkIcons.Zap size={18} className="fill-current" />
              </div>
              {error}
            </div>
          )}
          
          <form onSubmit={handleSubmit} className="space-y-5" noValidate>
            <div className="space-y-4">
              <Input 
                label="Primary Admin Entity"
                placeholder="admin@fromcode.com"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                error={fieldErrors.email}
                className="py-3 text-sm"
              />
              
              <div className="space-y-4">
                <Input 
                  label="Root Password"
                  placeholder="••••••••••••"
                  type="password"
                  required
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  error={fieldErrors.password}
                  className="py-3 text-sm"
                />
                <Input 
                  label="Validate Password"
                  placeholder="••••••••••••"
                  type="password"
                  required
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  error={fieldErrors.confirmPassword}
                  className="py-3 text-sm"
                />
              </div>
            </div>

            <div className="bg-slate-50 dark:bg-indigo-500/5 rounded-2xl p-4 border border-slate-100 dark:border-indigo-500/10">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-xl bg-indigo-500 text-white shadow-lg shadow-indigo-500/30 mt-0.5">
                  <FrameworkIcons.Shield size={16} />
                </div>
                <div>
                  <h4 className="text-xs font-semibold mb-1 tracking-wide text-indigo-900 dark:text-indigo-300">Omnipotent Privilege</h4>
                  <p className="text-[10px] text-slate-500 font-medium leading-relaxed italic">
                    This account holds master keys to all infrastructure, deployments, and sensitive user telemetry.
                  </p>
                </div>
              </div>
            </div>

            <Button 
              type="submit" 
              className="w-full py-4 text-base font-semibold transform hover:scale-[1.01] active:scale-[0.98] shadow-2xl shadow-indigo-600/30 rounded-2xl"
              isLoading={isLoading}
            >
              Initialize Framework
              {!isLoading && <FrameworkIcons.ArrowRight size={18} className="ml-2.5" />}
            </Button>
          </form>
        </div>

        <div className="text-center mt-5 flex items-center justify-center gap-4 opacity-40 text-slate-500">
           <div className="h-[2px] w-8 bg-slate-200 dark:bg-slate-800 rounded-full" />
           <span className="text-[10px] font-semibold tracking-wide">
             v{AppEnv.APP_VERSION} {AppEnv.APP_NAME} {AppEnv.APP_CHANNEL}
           </span>
           <div className="h-[2px] w-8 bg-slate-200 dark:bg-slate-800 rounded-full" />
        </div>
      </div>
    </div>
  );
}
