"use client";

import React from 'react';
import { AdminComponent } from '@/components/admin-component';
import { AdminShellRegistry } from '@/lib/appearance/admin-shell-registry';
import ClientLayoutShell from './client-layout-shell';
import AppearanceSecurityGate from './appearance-security-gate';
import type { AppearanceShellProps } from '@/lib/appearance/appearance-shell-props.interfaces';

/**
 * Chooses the chrome for the active appearance. With NO appearance shell registered, it renders
 * today's `ClientLayoutShell` exactly — which owns its own auth gating — so the default admin is
 * byte-for-byte unchanged. With an appearance shell active, the shared `AppearanceSecurityGate`
 * enforces auth (so the appearance never re-owns it) and then renders the appearance shell as a
 * presentation-only layer with the read-only nav/user model.
 */
export default class AppearanceShellHost extends AdminComponent<AppearanceShellProps> {
  render(): React.ReactNode {
    const AppearanceShell = AdminShellRegistry.shared.resolve(this.activeAppearanceId);
    if (!AppearanceShell) {
      return <ClientLayoutShell>{this.props.children}</ClientLayoutShell>;
    }
    return (
      <AppearanceSecurityGate Shell={AppearanceShell} nav={this.props.nav} user={this.props.user}>
        {this.props.children}
      </AppearanceSecurityGate>
    );
  }
}
