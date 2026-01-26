"use client";

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/components/AuthContext';
import { useTheme } from '@/components/ThemeContext';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { FrameworkIcons } from '@/lib/icons';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { ENDPOINTS } from '@/lib/constants';

const { Zap, Mail, Lock, ArrowRight, Shield: ShieldCheck, UserPlus, Orbit } = FrameworkIcons;

const ICON_SIZE = 42;

export default function SetupPage() {
  const router = useRouter();
  const { theme } = useTheme();
  const { login } = useAuth();
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
        const data = await api.get(ENDPOINTS.AUTH.STATUS);
        if (data.initialized === true) {
          router.push('/login');
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
      const data = await api.post(ENDPOINTS.AUTH.SETUP, { email, password });
      login(data.token, data.user);
    } catch (err: any) {
      setError(err.message || 'Setup failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  if (isChecking) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${theme === 'dark' ? 'bg-slate-950' : 'bg-slate-50'}`}>
        <div className="flex flex-col items-center gap-6">
          <div className="relative">
            <div className="h-16 w-16 border-[5px] border-indigo-600/10 rounded-3xl"></div>
            <div className="absolute inset-0 h-16 w-16 border-[5px] border-indigo-600 border-t-transparent rounded-3xl animate-spin"></div>
          </div>
          <span className="text-[11px] font-black text-indigo-500 uppercase tracking-[0.2em] animate-pulse">Initializing Ecosystem...</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen flex items-center justify-center p-6 sm:p-12 ${theme === 'dark' ? 'bg-[#020617]' : 'bg-slate-50'}`}>
      <div className="w-full max-w-lg">
        <div className="text-center mb-12 animate-in fade-in slide-in-from-top-4 duration-1000">
          <div className="inline-flex items-center justify-center w-24 h-24 bg-white dark:bg-slate-900 rounded-[2rem] shadow-[0_20px_50px_rgba(79,70,229,0.15)] mb-8 transform hover:scale-105 transition-all duration-500 ring-1 ring-slate-100 dark:ring-slate-800">
            <FrameworkIcons.Orbit size={ICON_SIZE} className="text-indigo-600 animate-[spin_10s_linear_infinite]" />
          </div>
          <h1 className={`text-5xl font-black tracking-tighter mb-4 ${theme === 'dark' ? 'text-white' : 'text-slate-950'}`}>
            System Setup
          </h1>
          <p className="text-slate-500 font-medium text-lg leading-relaxed max-w-[340px] mx-auto">Create the root administrator account to unlock your digital core.</p>
        </div>

        <div className={`p-10 sm:p-12 rounded-[3.5rem] border shadow-[0_32px_64px_-12px_rgba(0,0,0,0.14)] dark:shadow-black/60 animate-in fade-in slide-in-from-bottom-8 duration-1000 ${theme === 'dark' ? 'bg-slate-900/50 border-slate-800' : 'bg-white border-white'}`}>
          {error && (
            <div className="mb-8 p-5 rounded-3xl bg-rose-50 border border-rose-100 dark:bg-rose-500/10 dark:border-rose-500/20 text-rose-600 text-[13px] font-black animate-in zoom-in duration-300 flex items-center gap-4">
              <div className="flex-shrink-0 h-10 w-10 rounded-2xl bg-rose-100 dark:bg-rose-500/20 flex items-center justify-center">
                <FrameworkIcons.Zap size={18} className="fill-current" />
              </div>
              {error}
            </div>
          )}
          
          <form onSubmit={handleSubmit} className="space-y-8" noValidate>
            <div className="space-y-6">
              <Input 
                label="Primary Admin Entity"
                placeholder="admin@fromcode.com"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                error={fieldErrors.email}
                className="py-4 text-base"
              />
              
              <div className="space-y-6">
                <Input 
                  label="Root Password"
                  placeholder="••••••••••••"
                  type="password"
                  required
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  error={fieldErrors.password}
                  className="py-4 text-base"
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
                  className="py-4 text-base"
                />
              </div>
            </div>

            <div className="bg-slate-50 dark:bg-indigo-500/5 rounded-[2rem] p-6 border border-slate-100 dark:border-indigo-500/10">
              <div className="flex items-start gap-4">
                <div className="p-2.5 rounded-xl bg-indigo-500 text-white shadow-lg shadow-indigo-500/30 mt-1">
                  <FrameworkIcons.Shield size={20} />
                </div>
                <div>
                  <h4 className={`text-sm font-black mb-1 uppercase tracking-tight ${theme === 'dark' ? 'text-indigo-300' : 'text-indigo-900'}`}>Omnipotent Privilege</h4>
                  <p className="text-[11px] text-slate-500 font-medium leading-relaxed italic">
                    This account holds master keys to all infrastructure, deployments, and sensitive user telemetry.
                  </p>
                </div>
              </div>
            </div>

            <Button 
              type="submit" 
              className="w-full py-7 text-xl font-black transform hover:scale-[1.02] active:scale-[0.98] shadow-2xl shadow-indigo-600/30 rounded-3xl"
              isLoading={isLoading}
            >
              Initialize Framework
              {!isLoading && <FrameworkIcons.ArrowRight size={22} className="ml-3" />}
            </Button>
          </form>
        </div>

        <div className="text-center mt-12 flex items-center justify-center gap-6 opacity-40">
           <div className="h-[2px] w-12 bg-slate-200 dark:bg-slate-800 rounded-full" />
           <span className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">v0.1.0 Nexus Alpha</span>
           <div className="h-[2px] w-12 bg-slate-200 dark:bg-slate-800 rounded-full" />
        </div>
      </div>
    </div>
  );
}
