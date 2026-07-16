"use client";

import React from 'react';
import { AdminComponent } from '@/components/admin-component';
import { AdminShellRegistry } from '@/lib/appearance/admin-shell-registry';
import { AdminAppearanceRegistry } from '@/lib/appearance/admin-appearance-registry';
import { AppearanceSurfacePolicy } from '@/lib/appearance/appearance-surface-policy';
import ClientLayoutShell from './client-layout-shell';
import AppearanceSecurityGate from './appearance-security-gate';
import AppearanceRouteBlockedShell from './appearance-route-blocked-shell';
import type { AppearanceShellProps } from '@/lib/appearance/appearance-shell-props.interfaces';

/**
 * Chooses the chrome for the active appearance. With NO appearance shell registered, it renders
 * today's `ClientLayoutShell` exactly — which owns its own auth gating — so the default admin is
 * byte-for-byte unchanged. With an appearance shell active, the shared `AppearanceSecurityGate`
 * enforces auth (so the appearance never re-owns it) and then renders the appearance shell as a
 * presentation-only layer with the read-only nav/user model.
 *
 * Surface containment: when the active appearance declares a `surfaces` allowlist, a route outside it is
 * rendered as `AppearanceRouteBlockedShell` (through the SAME auth gate, so login/loading are unaffected)
 * instead of leaking the page. An absent allowlist means the appearance exposes everything (passthrough).
 * This is presentation containment only — role/permission authorization is enforced server-side regardless.
 */
export default class AppearanceShellHost extends AdminComponent<AppearanceShellProps> {
  render(): React.ReactNode {
    const id = this.activeAppearanceId;
    const AppearanceShell = AdminShellRegistry.shared.resolve(id);
    if (!AppearanceShell) {
      return <ClientLayoutShell>{this.props.children}</ClientLayoutShell>;
    }
    const surfaces = AdminAppearanceRegistry.shared.get(id)?.surfaces;
    const activePath = this.props.nav?.activePath || '/';
    const allowed = AppearanceSurfacePolicy.isPathAllowed(surfaces, activePath);
    const Shell = allowed ? AppearanceShell : AppearanceRouteBlockedShell;
    return (
      <AppearanceSecurityGate Shell={Shell} nav={this.props.nav} user={this.props.user}>
        {allowed ? this.props.children : null}
      </AppearanceSecurityGate>
    );
  }
}
