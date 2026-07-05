"use client";

import React from 'react';
import { Loader } from '@/components/ui/loader';
import { ClientLayoutAuthStateHooks } from './services/client-layout-auth-state-hooks';
import PluginLoader from './plugin-loader';
import type { AppearanceSecurityGateProps } from '@/lib/appearance/appearance-security-gate.interfaces';

/**
 * Shared AUTH gate for appearance shells (authentication only — NOT authorization). Runs the same auth
 * state the default shell uses and renders the loading/redirect screens, so an appearance is presentation-
 * only and never re-owns auth. It renders the shell for ANY authenticated user — it deliberately does NOT
 * deny by role. Authorization is the appearance's job (the shell renders role-appropriate views) and the
 * API's job (every endpoint scopes/permits by role server-side). An MLM platform admin AND a partner both
 * log in here; each sees what their role allows. The DEFAULT admin does NOT pass through this gate.
 */
export default function AppearanceSecurityGate({ Shell, nav, user, children }: AppearanceSecurityGateProps) {
  const authState = ClientLayoutAuthStateHooks.useState();

  if (authState.isInitialized === null || (authState.isAuthLoading && !authState.isAuthPage)) {
    return <div className="flex min-h-screen items-center justify-center bg-slate-50 transition-colors duration-500 dark:bg-[#020617]"><Loader label="Initializing Secure Session" /></div>;
  }

  if (!authState.user && !authState.isAuthPage) {
    return <div className="flex min-h-screen items-center justify-center bg-slate-50 transition-colors duration-500 dark:bg-[#020617]"><Loader label="Forwarding to Authentication..." /></div>;
  }

  if (authState.isAuthPage) {
    return <div className="min-h-screen bg-slate-50 font-sans transition-colors duration-300 dark:bg-[#020617]">{children}</div>;
  }

  // Authed user (any role) on a normal page. PluginLoader is the shared DATA layer (loads plugin metadata + the
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
