import type { ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/react-class-components';
import { SiteTab } from '@/app/sites/[id]/site-tab.enum';

/** The section switcher for a site's page. Presentational — the page owns which tab is current. */
export class SiteTabBar extends PureReactor {
  declare props: Pick<SiteTabBar, 'current' | 'onSelect'>;

  @prop declare current: SiteTab;
  @prop declare onSelect: (tab: SiteTab) => void;

  render(): ReactNode {
    return (
      <nav className="fc-sites__tabs" role="tablist">
        {(SiteTab.values() as SiteTab[]).map((tab) => (
          <button
            key={tab.value}
            type="button"
            role="tab"
            aria-selected={tab.value === this.current.value}
            className={`fc-sites__tab${tab.value === this.current.value ? ' fc-sites__tab--active' : ''}`}
            onClick={() => this.onSelect(tab)}
          >
            {tab.label}
          </button>
        ))}
      </nav>
    );
  }
}
