import type { ReactNode } from 'react';
import { AdminComponent } from '@/components/view/admin-component.client';
import { bound, prop, state } from '@fromcode119/react-class-components';
import { Button } from '@/components/ui/view/button.client';
import { FrameworkIcons } from '@fromcode119/react';
import { PlatformAccess } from '@/lib/tenants/platform-access';
import { PlatformSettingLocks } from '@/lib/settings/platform-setting-locks';
import { TenantScopeClient } from '@/lib/tenants/tenant-scope-client';

/**
 * A screen that belongs to the PLATFORM, refusing to render inside a site.
 *
 * Hiding the sidebar entry is not the same as guarding the page. The route still resolved, so a
 * bookmark, a back button or a typed URL landed an operator on the platform's own screen while they
 * were standing in a site — the Sources list showed every repository this installation builds, under
 * a header naming one customer. Stepping into a site is meant to make the console that site's.
 *
 * Says where the screen lives rather than showing a 404, and offers the switch, because a page an
 * operator cannot reach and cannot locate is the other half of the same problem. Same notice block
 * and the same action as the settings screen uses for the settings it is not showing.
 *
 * Renders its children unchanged on a single-tenant deployment: there is no second scope to be in.
 */
export class PlatformScopeGate extends AdminComponent {
  declare props: Pick<PlatformScopeGate, 'what' | 'children'>;

  /** What this screen is, named in the sentence: "Sources lives in Platform scope." */
  @prop declare what: string;
  @prop declare children: ReactNode;

  @state private locks = PlatformSettingLocks.none();
  @state private resolved = false;

  async componentDidMount(): Promise<void> {
    this.locks = await PlatformSettingLocks.load();
    this.resolved = true;
  }

  @bound
  async openPlatformScope(): Promise<void> {
    await TenantScopeClient.leaveAndReload();
  }

  private get canManagePlatform(): boolean {
    return PlatformAccess.canManagePlatform(this.auth.user);
  }

  render(): ReactNode {
    // Until the scope is known, render the page. The alternative is a flash of "wrong scope" on every
    // load in the scope where the screen is perfectly valid, which is the common case.
    if (!this.resolved || !this.locks.isSiteScope()) return this.children;

    return (
      <div className="fc-scope-notice">
        <span className="fc-scope-notice__text">
          {this.what} belongs to the platform and is not part of this site. Switch to Platform scope to open it.
        </span>
        {this.canManagePlatform ? (
          <Button
            onClick={this.openPlatformScope}
            icon={<FrameworkIcons.Globe size={13} strokeWidth={2} />}
            className="h-8 px-3 rounded-lg text-[11px] font-bold uppercase tracking-tight flex-shrink-0"
          >
            Open Platform Scope
          </Button>
        ) : null}
      </div>
    );
  }
}
