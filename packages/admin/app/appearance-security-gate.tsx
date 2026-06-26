"use client";

import React from 'react';
import { FrameworkIcons } from '@fromcode119/react';
import { Loader } from '@/components/ui/loader';
import { AdminConstants } from '@/lib/constants';
import { AuthUtils } from '@/lib/auth-utils';
import { ClientLayoutAuthStateHooks } from './services/client-layout-auth-state-hooks';
import PluginLoader from './plugin-loader';
import type { AppearanceSecurityGateProps } from '@/lib/appearance/appearance-security-gate.interfaces';

/**
 * Shared security gate for appearance shells. Runs the SAME auth state the default shell uses and
 * renders the security/loading screens itself — so an appearance shell is presentation-only and never
 * re-owns auth. Renders the presentation `Shell` (with the nav/user model) only for an authed admin on
 * a normal page. The DEFAULT admin does NOT pass through this (it renders ClientLayoutShell unchanged).
 */
export default function AppearanceSecurityGate({ Shell, nav, user, children }: AppearanceSecurityGateProps) {
  const authState = ClientLayoutAuthStateHooks.useState();

  if (authState.user && !authState.isAuthPage && !authState.user.roles?.includes('admin')) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-[#020617]">
        <div className="max-w-md space-y-6 p-12 text-center">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-rose-500/10 text-rose-500 shadow-xl shadow-rose-500/10">
            <FrameworkIcons.Zap size={40} />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Access Restricted</h1>
            <p className="text-sm font-medium leading-relaxed text-slate-500">
              Your account <span className="font-bold text-indigo-500">{authState.user.email}</span> does not have the required admin privileges to access this console.
            </p>
          </div>
          <button
            onClick={() => {
              AuthUtils.purgeAuth();
              authState.router.push(AdminConstants.ROUTES.AUTH.LOGIN);
            }}
            className="w-full rounded-2xl bg-slate-900 py-4 text-[11px] font-semibold tracking-wide text-white shadow-2xl transition-transform hover:scale-[1.02] dark:bg-white dark:text-slate-900"
          >
            Switch Account
          </button>
        </div>
      </div>
    );
  }

  if (authState.isInitialized === null || (authState.isAuthLoading && !authState.isAuthPage)) {
    return <div className="flex min-h-screen items-center justify-center bg-slate-50 transition-colors duration-500 dark:bg-[#020617]"><Loader label="Initializing Secure Session" /></div>;
  }

  if (!authState.user && !authState.isAuthPage) {
    return <div className="flex min-h-screen items-center justify-center bg-slate-50 transition-colors duration-500 dark:bg-[#020617]"><Loader label="Forwarding to Authentication..." /></div>;
  }

  if (authState.isAuthPage) {
    return <div className="min-h-screen bg-slate-50 font-sans transition-colors duration-300 dark:bg-[#020617]">{children}</div>;
  }

  // Authed admin on a normal page. PluginLoader is the shared DATA layer (loads plugin metadata + the
  // admin menu into the plugins context); it lives here so the appearance path gets the same populated
  // nav the default shell does, without touching ClientLayoutShell. The gate owns the authed user, so it
  // supplies the user model to the presentation shell (falling back to any caller-provided user).
  const shellUser = authState.user
    ? { email: authState.user.email, roles: authState.user.roles }
    : user;
  return (
    <>
      <PluginLoader />
      <Shell nav={nav} user={shellUser}>{children}</Shell>
    </>
  );
}
