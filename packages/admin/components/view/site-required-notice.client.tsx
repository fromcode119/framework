import type { ReactNode } from 'react';
import { prop, state } from '@fromcode119/react-class-components';
import { FrameworkIcons } from '@fromcode119/react';
import { AdminComponent } from '@/components/view/admin-component.client';
import { Button } from '@/components/ui/view/button.client';
import { AdminApi } from '@/lib/api';
import { AdminConstants } from '@/lib/constants/admin.constants';
import { AdminI18n } from '@/lib/i18n/admin-i18n';
import { PlatformAccess } from '@/lib/tenants/platform-access';

/**
 * Stands in for a screen of a site's own records (media, people) when there is no site to hold them.
 *
 * Two cases, and the notice says which: the platform scope of a multi-site installation, where a site
 * has to be chosen first; and an installation that has no site yet, where the first one has to be
 * added. Before this, both showed the screen as if it worked — and on a fresh install every upload
 * failed with a database error. The answer comes from the api (`siteOwnedWrites`), not a guess here.
 */
export class SiteRequiredNotice extends AdminComponent {
  declare props: Pick<SiteRequiredNotice, 'subject' | 'children'>;

  /** Which records: `media` or `people` — picks the sentence, which each language words its own way. */
  @prop declare subject: string;
  @prop declare children: ReactNode;

  @state private resolved = false;
  @state private blocked = false;
  @state private multiTenant = false;

  private mounted = false;

  async componentDidMount(): Promise<void> {
    this.mounted = true;
    const response = await AdminApi.get(AdminConstants.ENDPOINTS.AUTH.TENANTS_AVAILABLE).catch(() => null);
    if (!this.mounted) return;
    this.blocked = response?.siteOwnedWrites === false;
    this.multiTenant = response?.multiTenant === true;
    this.resolved = true;
  }

  componentWillUnmount(): void {
    this.mounted = false;
  }

  render(): ReactNode {
    if (!this.resolved) return null;
    if (!this.blocked) return this.children;
    const key = this.multiTenant ? 'chooseSite' : 'noSiteYet';
    const offerSites = !this.multiTenant && PlatformAccess.canManagePlatform(this.auth.user);
    return (
      <div className="fc-scope-notice">
        <span className="fc-scope-notice__text">{AdminI18n.t(`ui.view.siteRequired.${key}.${this.subject}`)}</span>
        {offerSites ? (
          <Button
            onClick={() => this.router.push(AdminConstants.ROUTES.SITES.ROOT)}
            icon={<FrameworkIcons.Globe size={13} strokeWidth={2} />}
            className="h-8 px-3 rounded-lg text-[11px] font-bold uppercase tracking-tight flex-shrink-0"
          >
            {AdminI18n.t('ui.view.siteRequired.openSites')}
          </Button>
        ) : null}
      </div>
    );
  }
}
