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
    
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setIsLoading(true);
    setError('');
    
    try {
      const data = await api.post(ENDPOINTS.AUTH.SETUP, { email, password });

      // Redirection handled by AuthContext or middleware on state change
      login(data.token, data.user);
    } catch (err: any) {
      setError(err.message || 'Setup failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  if (isChecking) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${theme === 'dark' ? 'bg-[#020617]' : 'bg-slate-50'}`}>
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Deploying Environment...</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen flex items-center justify-center p-6 ${theme === 'dark' ? 'bg-[#020617]' : 'bg-slate-50'}`}>
      <div className="w-full max-w-lg animate-in fade-in slide-in-from-bottom-4 duration-700">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-tr from-indigo-600 to-purple-600 rounded-3xl shadow-2xl shadow-indigo-600/30 mb-8 transform hover:rotate-12 transition-transform">
            <Orbit size={42} className="text-white animate-pulse" />
          </div>
          <h1 className={`text-4xl font-black tracking-tight mb-3 ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
            System Initialization
          </h1>
          <p className="text-slate-500 font-medium max-w-md mx-auto">Welcome to Fromcode. Create the first administrative account to begin setting up your platform.</p>
        </div>

        <div className={`p-10 rounded-[2.5rem] border shadow-2xl ${theme === 'dark' ? 'bg-[#0f172a] border-slate-800 shadow-black/60' : 'bg-white border-slate-200'}`}>
          {error && (
            <div className="mb-8 p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-500 text-sm font-bold animate-in fade-in zoom-in duration-300 flex items-center gap-3">
              <div className="h-2 w-2 rounded-full bg-rose-50" />
              {error}
            </div>
          )}
          
          <form onSubmit={handleSubmit} className="space-y-8">
            <div className="grid grid-cols-1 gap-6">
              <Input 
                label="Primary Admin Email"
                placeholder="admin@yourdomain.com"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Input 
                  label="Secure Password"
                  placeholder="••••••••"
                  type="password"
                  required
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <Input 
                  label="Confirm Password"
                  placeholder="••••••••"
                  type="password"
                  required
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </div>
            </div>

            <div className="bg-indigo-500/5 rounded-2xl p-6 border border-indigo-500/10">
              <div className="flex items-start gap-4">
                <div className="p-2 rounded-lg bg-indigo-500/20 text-indigo-500 mt-1">
                  <ShieldCheck size={20} />
                </div>
                <div>
                  <h4 className={`text-sm font-bold mb-1 ${theme === 'dark' ? 'text-indigo-300' : 'text-indigo-900'}`}>Full System Access</h4>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    This account will have unrestricted access to all system modules, configurations, and sensitive data. Ensure you use a strong, unique password.
                  </p>
                </div>
              </div>
            </div>

            <Button 
              type="submit" 
              className="w-full py-5 text-lg font-black transform hover:scale-[1.01] active:scale-[0.99] shadow-xl shadow-indigo-600/20"
              isLoading={isLoading}
            >
              Initialize System & Create Admin
              {!isLoading && <ArrowRight size={20} className="ml-2" />}
            </Button>
          </form>
        </div>

        <div className="text-center mt-12 flex items-center justify-center gap-6">
           <div className="h-px w-12 bg-slate-200 dark:bg-slate-800" />
           <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">v0.1.0 Framework Alpha</span>
           <div className="h-px w-12 bg-slate-200 dark:bg-slate-800" />
        </div>
      </div>
    </div>
  );
}
