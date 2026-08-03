import type { ReactNode } from 'react';
import { prop } from '@fromcode119/reactor';
import { AdminComponent } from '@/components/view/admin-component.client';
import { AdminShellRegistry } from '@/lib/appearance/admin-shell-registry';
import { AdminAppearanceRegistry } from '@/lib/appearance/admin-appearance-registry';
import { AppearanceSurfacePolicy } from '@/lib/appearance/appearance-surface-policy';
import { ClientLayoutShell } from '@/app/components/view/client-layout-shell.client';
import { AppearanceSecurityGate } from '@/app/components/view/appearance-security-gate.client';
import { AppearanceRouteBlockedShell } from '@/app/components/view/appearance-route-blocked-shell.client';
import type { IAppearanceNavItem } from '@/lib/appearance/interfaces/appearance-nav-item.interface';
import type { IAppearanceShellUser } from '@/lib/appearance/interfaces/appearance-shell-user.interface';

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
export class AppearanceShellHost extends AdminComponent {
  @prop declare children: ReactNode;
  @prop declare nav?: { items: IAppearanceNavItem[]; activePath: string };
  @prop declare user?: IAppearanceShellUser;

  render(): ReactNode {
    const id = this.activeAppearanceId;
    const AppearanceShell = AdminShellRegistry.shared.resolve(id);
    if (!AppearanceShell) {
      return <ClientLayoutShell>{this.children}</ClientLayoutShell>;
    }
    const surfaces = AdminAppearanceRegistry.shared.get(id)?.surfaces;
    const activePath = this.nav?.activePath || '/';
    const allowed = AppearanceSurfacePolicy.isPathAllowed(surfaces, activePath);
    const Shell = allowed ? AppearanceShell : AppearanceRouteBlockedShell;
    return (
      <AppearanceSecurityGate Shell={Shell} nav={this.nav} user={this.user}>
        {allowed ? this.children : null}
      </AppearanceSecurityGate>
    );
  }
}
