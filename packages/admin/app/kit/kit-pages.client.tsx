import type { ReactNode } from 'react';
import { Reactor, state, bound } from '@fromcode119/react-class-components';
import { FrameworkIcons } from '@fromcode119/react';
import { RecordCard } from '@/components/ui/view/record-card.client';
import { Button } from '@/components/ui/view/button.client';
import { ButtonVariant } from '@/components/ui/enums/button-variant.enum';
import { Alert } from '@/components/ui/view/alert.client';
import { ListShell } from '@/components/ui/view/list-shell.client';
import { DataTable } from '@/components/ui/view/data-table.client';
import { StateBadge } from '@/components/ui/view/state-badge.client';
import { Avatar } from '@/components/ui/view/avatar.client';
import { PageBar } from '@/components/ui/view/page-bar.client';
import { SearchField } from '@/components/ui/view/search-field.client';
import { StatePage } from '@/components/ui/view/state-page.client';
import { ListRow } from '@/components/ui/view/list-row.client';
import { ListCard } from '@/components/ui/view/list-card.client';
import { Tabs } from '@/components/ui/view/tabs.client';
import { Switch } from '@/components/ui/view/switch.client';
import { Dialog } from '@/components/ui/view/dialog.client';
import { Tooltip } from '@/components/ui/view/tooltip.client';
import { Badge } from '@/components/ui/view/badge.client';
import { BadgeVariant } from '@/components/ui/enums/badge-variant.enum';

/**
 * What a console PAGE is put together from, beyond single controls: the note at its head, the row of a
 * list of installed things, the bar of filters with its search, the empty list, the page that has
 * nothing to show, the wide dialog. A page is built from these; a page that needs something that is
 * not here adds it here first.
 */
export class KitPages extends Reactor {
  @state private filter = 'all';
  @state private query = '';
  @state private on = false;
  @state private wide = false;
  @state private agreed = false;

  @bound private setQuery(value: string): void { this.query = value; }
  @bound private setFilter(id: string): void { this.filter = id; }
  @bound private setOn(value: boolean): void { this.on = value; }
  @bound private setAgreed(value: boolean): void { this.agreed = value; }
  @bound private openWide(): void { this.agreed = false; this.wide = true; }
  @bound private closeWide(): void { this.wide = false; }

  private static nothing(): void { /* a sample has nothing to do */ }

  private card(name: string, children: ReactNode): ReactNode {
    return (
      <RecordCard title={name} id={`kit-${name.toLowerCase().replace(/[^a-z]+/g, '-')}`}>
        <div className="fc-kit__pad fc-kit__stack">{children}</div>
      </RecordCard>
    );
  }

  render(): ReactNode {
    return (
      <>
        {this.card('Note at the head of a page', (
          <>
            <Alert tone="warning" action={<Button variant={ButtonVariant.SECONDARY}>Review and approve</Button>}>Two plugins wait for your approval. They stay off until an admin approves them.</Alert>
            <Alert tone="danger">One plugin failed to start.</Alert>
            <Alert tone="success">Everything is up to date.</Alert>
            <Alert tone="info" title="Update available" action={<><Button variant={ButtonVariant.GHOST}>Dismiss</Button><Button variant={ButtonVariant.SECONDARY}>View details</Button></>}>A new version is available.</Alert>
          </>
        ))}
        {this.card('Filters, search and the page action', (
          <PageBar lead={<Tabs label="Filter" value={this.filter} onChange={this.setFilter} tabs={[{ id: 'all', label: 'All', count: 2 }, { id: 'active', label: 'Active', count: 1 }, { id: 'off', label: 'Off', count: 1 }]} />}>
            <SearchField value={this.query} onChange={this.setQuery} placeholder="Search" />
            <Button icon={<FrameworkIcons.Upload size={15} />}>Upload</Button>
          </PageBar>
        ))}
        <div id="kit-list-as-one-card">
          <ListShell
            title="List as one card"
            count={3}
            actions={<Button variant={ButtonVariant.PRIMARY} icon={<FrameworkIcons.Plus size={15} />}>New</Button>}
            lead={<Tabs label="Kind" value={this.filter} onChange={this.setFilter} tabs={[{ id: 'all', label: 'All' }, { id: 'active', label: 'Active' }, { id: 'off', label: 'Off' }]} />}
            tools={<SearchField value={this.query} onChange={this.setQuery} placeholder="Search" />}
          >
            <DataTable
              columns={[
                { header: 'State', id: 'state', accessor: (row: any) => <StateBadge tone={row.tone}>{row.state}</StateBadge> },
                { header: 'What happened', id: 'what', className: 'fc-dt-fill', accessor: (row: any) => row.what },
                { header: 'Who', id: 'who', accessor: (row: any) => <span className="fc-dt-who"><Avatar fallback={row.who[0]} size="xsmall" /><span>{row.who}</span></span> },
                { header: 'Time', id: 'time', accessor: (row: any) => row.time },
              ] as any}
              data={[
                { id: 1, tone: 'success', state: 'Info', what: 'Delivered sales for the period report registered with finance, a sentence long enough to be cut where the column ends', who: 'System', time: 'Nov 19, 2026, 2:59 PM' },
                { id: 2, tone: 'warning', state: 'Warn', what: 'Stored product pages not emptied after a start', who: 'Maria', time: 'Nov 19, 2026, 2:00 PM' },
                { id: 3, tone: 'danger', state: 'Error', what: 'The mail server refused the connection', who: 'System', time: 'Nov 19, 2026, 1:12 PM' },
              ]}
            />
          </ListShell>
        </div>
        {this.card('Row of a list of installed things', (
          <ListCard>
            <ListRow
              icon={<FrameworkIcons.Plugins size={16} />}
              title={<span>Finance Core</span>}
              badges={<Tooltip content="What changed since it was approved: +database +api"><Badge variant={BadgeVariant.WARNING}>Waiting for approval</Badge></Tooltip>}
              description="Wallets, gift cards and the transaction ledger."
              meta="v0.1.172 · Fromcode Core"
              actions={<Switch checked={this.on} onChange={this.setOn} />}
              menu={[{ label: 'Open', onClick: KitPages.nothing }, { label: 'Remove', onClick: KitPages.nothing }]}
            />
            <ListRow
              initials="K"
              title={<span>Kristian</span>}
              badges={<><Badge variant={BadgeVariant.SUCCESS}>Administrator</Badge><Badge variant={BadgeVariant.DANGER}>Suspended</Badge><Badge variant={BadgeVariant.DEFAULT}>No account</Badge></>}
              description="kristian@example.com"
              meta="Joined 19.11.2026"
              actions={<Button variant={ButtonVariant.SECONDARY}>Create login</Button>}
            />
            <ListRow icon={<FrameworkIcons.Plugins size={16} />} title={<span>E-commerce Suite</span>} badges={<Badge variant={BadgeVariant.DANGER}>Error</Badge>} description="The plugin failed to start." failed meta="v0.1.480" />
          </ListCard>
        ))}
        {this.card('Empty list', <ListCard empty="Nothing is installed yet." />)}
        {this.card('A page with nothing to show', (
          <StatePage icon={<FrameworkIcons.Search size={18} />} title="Not found" hint="The record is missing, or it is not yours to open."
            actions={<><Button variant={ButtonVariant.SECONDARY}>Go back</Button><Button variant={ButtonVariant.PRIMARY}>To the dashboard</Button></>} />
        ))}
        {this.card('Wide dialog with a list to read', <Button variant={ButtonVariant.SECONDARY} onClick={this.openWide}>Open</Button>)}
        <Dialog
          wide
          isOpen={this.wide}
          onClose={this.closeWide}
          title="Approve “Finance Core” 0.1.172"
          description="Nothing of this plugin runs until you approve it."
          foot={<><Button variant={ButtonVariant.SECONDARY} onClick={this.closeWide}>Cancel</Button><Button variant={ButtonVariant.PRIMARY} disabled={!this.agreed} onClick={this.closeWide}>Approve and turn on</Button></>}
        >
          <div className="fc-consent">
            <p className="fc-consent__overview">It asks for 3 permissions: 1 high risk, 2 medium.</p>
            <div className="fc-consent__list">
              <div className="fc-consent__groups">
                <section>
                  <h4 className="fc-consent__heading" data-risk="high">High risk (1)</h4>
                  <ul className="fc-consent__entries">
                    <li className="fc-consent__entry"><div><p className="fc-consent__title">Runs database queries it writes itself</p><p className="fc-consent__text">Sends its own SQL to its own tables.</p></div><Badge variant={BadgeVariant.INFO}>New</Badge></li>
                  </ul>
                </section>
                <section>
                  <h4 className="fc-consent__heading" data-risk="medium">Medium risk (2)</h4>
                  <ul className="fc-consent__entries">
                    <li className="fc-consent__entry"><div><p className="fc-consent__title">Adds console screens</p><p className="fc-consent__text">Shows its own pages and menus to admins.</p></div><Badge variant={BadgeVariant.INFO}>New</Badge></li>
                    <li className="fc-consent__entry"><div><p className="fc-consent__title">Adds its own API endpoints</p><p className="fc-consent__text">Answers requests at addresses under its own name.</p></div></li>
                  </ul>
                </section>
              </div>
            </div>
            <div className="fc-consent__ack"><Switch checked={this.agreed} onChange={this.setAgreed} label="I understand what it will be able to do." /></div>
          </div>
        </Dialog>
      </>
    );
  }
}
