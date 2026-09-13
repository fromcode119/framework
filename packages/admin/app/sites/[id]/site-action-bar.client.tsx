import type { ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/react-class-components';
import { FrameworkIcons } from '@fromcode119/react';
import { Button } from '@/components/ui/view/button.client';
import { ButtonVariant } from '@/components/ui/enums/button-variant.enum';
import { SiteRecord } from '@/lib/tenants/site-record';

/**
 * The four things you can do to a site from its own page, in the order you reach for them.
 *
 * "Open this site" enters it, so every ordinary admin page then acts on THIS site — the one thing
 * this page offers that nothing else does. The rest lead somewhere else or write something.
 */
export class SiteActionBar extends PureReactor {
  declare props: Pick<SiteActionBar, 'site' | 'entering' | 'previewing' | 'exporting' | 'saving' | 'onEnter' | 'onVisit' | 'onExport' | 'onSave'>;

  @prop declare site: SiteRecord;
  @prop declare entering: boolean;
  @prop declare previewing: boolean;
  @prop declare exporting: boolean;
  @prop declare saving: boolean;
  @prop declare onEnter: () => void;
  @prop declare onVisit: () => void;
  @prop declare onExport: () => void;
  @prop declare onSave: () => void;

  /**
   * A workspace has no storefront, so there is nothing to open.
   *
   * The label names what the button DOES: on a site nobody can reach yet, "Visit" would be a lie,
   * and the two do genuinely different things — one is a link, the other mints a preview.
   */
  private renderStorefront(): ReactNode {
    if (this.site.isWorkspace) return null;
    return (
      <Button
        variant={ButtonVariant.OUTLINE}
        onClick={this.onVisit}
        isLoading={this.previewing}
        icon={<FrameworkIcons.ExternalLink size={14} />}
      >
        {this.site.isPrivate ? 'Preview' : 'Visit'}
      </Button>
    );
  }

  render(): ReactNode {
    return (
      <div className="fc-sites__actions">
        <Button onClick={this.onEnter} isLoading={this.entering} icon={<FrameworkIcons.ArrowRight size={14} />}>Open this site</Button>
        {this.renderStorefront()}
        <Button variant={ButtonVariant.OUTLINE} onClick={this.onExport} isLoading={this.exporting} icon={<FrameworkIcons.Download size={14} />}>Export</Button>
        <Button onClick={this.onSave} isLoading={this.saving} icon={<FrameworkIcons.Save size={14} />}>Save</Button>
      </div>
    );
  }
}
