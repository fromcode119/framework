import type { ReactNode } from 'react';
import { AdminComponent } from '@/components/view/admin-component.client';
import { prop, state } from '@fromcode119/react-class-components';
import { PlatformSettingLocks } from '@/lib/settings/platform-setting-locks';

/**
 * A "not found" answered in the PLATFORM scope, where the page may simply belong to a site.
 *
 * A site's pages — its orders, its invoices, anything a plugin serves inside a site — are not part of
 * the platform, so a bookmark or a typed URL opened while no site is selected used to say "Collection
 * Not Found" or "Module Not Found", as if the record did not exist. It exists; it lives in a site. The
 * reverse case, a platform screen opened inside a site, already says where it lives
 * ({@link PlatformScopeGate}); this is the same notice for the other direction.
 *
 * Only the scope is known here, not which site holds the page, so the notice points at the site menu
 * rather than guessing a site. Inside a site, and on a single-tenant deployment, the real "not found"
 * renders unchanged.
 */
export class SiteScopeGate extends AdminComponent {
  declare props: Pick<SiteScopeGate, 'what' | 'children'>;

  /** The page, named in the sentence: "/ecommerce/orders is not part of the platform." */
  @prop declare what: string;
  @prop declare children: ReactNode;

  @state private locks = PlatformSettingLocks.none();
  @state private resolved = false;

  async componentDidMount(): Promise<void> {
    this.locks = await PlatformSettingLocks.load();
    this.resolved = true;
  }

  render(): ReactNode {
    if (!this.resolved || !this.locks.isPlatformScope()) return this.children;

    return (
      <div className="fc-scope-notice">
        <span className="fc-scope-notice__text">
          {this.what} is not part of the platform. If it belongs to a site, choose that site from the site menu to open it.
        </span>
      </div>
    );
  }
}
