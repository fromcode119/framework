import type { ReactNode } from 'react';
import { ThemeMode } from '@fromcode119/core/client';
import { PureReactor, prop } from '@fromcode119/reactor';
import { FrameworkIcons } from '@fromcode119/react';
import { Badge } from '@/components/ui/view/badge.client';
import { BadgeVariant } from '@/components/ui/enums/badge-variant.enum';
import { Button } from '@/components/ui/view/button.client';
import { ButtonVariant } from '@/components/ui/enums/button-variant.enum';
import { FieldSize } from '@/components/ui/enums/field-size.enum';
import { DataTable } from '@/components/ui/view/data-table.client';
import { Column } from '@/components/ui/column';
import { SiteRecord } from '@/lib/tenants/site-record';

/** The sites list. Presentational: every action is a callback into the page. */
export class SitesTable extends PureReactor {
  @prop declare theme: ThemeMode;
  @prop declare sites: SiteRecord[];
  @prop declare busyId: string | null;
  @prop declare onOpen: (site: SiteRecord) => void;
  @prop declare onExport: (site: SiteRecord) => void;
  @prop declare onToggleState: (site: SiteRecord) => void;
  @prop declare onDelete: (site: SiteRecord) => void;

  private get columns(): Column<SiteRecord>[] {
    return [
      { id: 'site', header: 'Site', accessor: (site) => (
        <div className="fc-sites__name">
          <span className="fc-sites__slug">{site.slug}</span>
          <span className="fc-sites__id">id {site.id}</span>
        </div>
      ) },
      { id: 'hosts', header: 'Hosts', accessor: (site) => (
        <div className="fc-sites__hosts">
          <span className="fc-sites__host fc-sites__host--primary">{site.primaryHost}</span>
          {site.hostAliases.map((alias) => <span key={alias} className="fc-sites__host">{alias}</span>)}
        </div>
      ) },
      { id: 'kind', header: 'Kind', accessor: (site) => (
        <div className="fc-sites__name">
          <Badge variant={site.isWorkspace ? BadgeVariant.INFO : BadgeVariant.GRAY}>{site.isWorkspace ? 'workspace' : 'site'}</Badge>
          {site.isWorkspace ? <span className="fc-sites__id">{site.appearance || 'default console'}</span> : null}
        </div>
      ) },
      { id: 'state', header: 'State', accessor: (site) => (
        <Badge variant={site.isActive ? BadgeVariant.SUCCESS : BadgeVariant.WARNING}>{site.state}</Badge>
      ) },
      { id: 'members', header: 'Members', accessor: (site) => String(site.memberCount) },
      { id: 'plugins', header: 'Plugins', accessor: (site) => (site.plugins.length ? site.plugins.join(', ') : <span className="fc-sites__none">none</span>) },
      { id: 'theme', header: 'Theme', accessor: (site) => (site.theme ? site.theme : <span className="fc-sites__none">no theme</span>) },
      { id: 'export', header: 'Last export', accessor: (site) => (site.lastExport ? <span className="fc-sites__export" title={site.lastExport}>{SitesTable.exportedAt(site.lastExport)}</span> : <span className="fc-sites__none">never</span>) },
    ];
  }

  /** `tenant-<slug>-2026-09-05T12-00-00-000Z.tar.gz` → `2026-09-05 12:00`. The full name is in the title. */
  private static exportedAt(filename: string): string {
    const match = filename.match(/(\d{4}-\d{2}-\d{2})T(\d{2})-(\d{2})/);
    return match ? `${match[1]} ${match[2]}:${match[3]}` : filename;
  }

  private static stop(event: { stopPropagation: () => void }): void {
    event.stopPropagation();
  }

  private renderActions(site: SiteRecord): ReactNode {
    const busy = this.busyId === site.id;
    return (
      // The row itself opens the site; a click on one of its buttons must not ALSO do that.
      <div className="fc-sites__row-actions" onClick={SitesTable.stop}>
        <Button size={FieldSize.SM} variant={ButtonVariant.GHOST} onClick={() => this.onOpen(site)} icon={<FrameworkIcons.Settings size={13} />}>Manage</Button>
        <Button size={FieldSize.SM} variant={ButtonVariant.GHOST} isLoading={busy} onClick={() => this.onExport(site)} icon={<FrameworkIcons.Download size={13} />}>Export</Button>
        <Button size={FieldSize.SM} variant={ButtonVariant.GHOST} isLoading={busy} onClick={() => this.onToggleState(site)} icon={site.isActive ? <FrameworkIcons.Pause size={13} /> : <FrameworkIcons.Play size={13} />}>
          {site.isActive ? 'Suspend' : 'Reactivate'}
        </Button>
        <Button size={FieldSize.SM} variant={ButtonVariant.GHOST} className="fc-sites__delete" isLoading={busy} onClick={() => this.onDelete(site)} icon={<FrameworkIcons.Trash size={13} />}>Delete</Button>
      </div>
    );
  }

  render(): ReactNode {
    return (
      <DataTable
        columns={this.columns}
        data={this.sites}
        actions={(site: SiteRecord) => this.renderActions(site)}
        stickyActions={false}
        onRowClick={this.onOpen}
        emptyMessage="No sites yet. Create one, or import an exported site."
      />
    );
  }
}
