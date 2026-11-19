import { FrameworkIcons } from '@fromcode119/react';
import { Card } from '@/components/ui/view/card.client';
import { RecordCard } from '@/components/ui/view/record-card.client';
import { ListShell } from '@/components/ui/view/list-shell.client';
import { ListShellHead } from '@/components/ui/view/list-shell-head.client';
import { ListCard } from '@/components/ui/view/list-card.client';
import { ListRow } from '@/components/ui/view/list-row.client';
import { PageBar } from '@/components/ui/view/page-bar.client';
import { StatePage } from '@/components/ui/view/state-page.client';
import { DataTable } from '@/components/ui/view/data-table.client';
import { Tabs } from '@/components/ui/view/tabs.client';
import { SearchField } from '@/components/ui/view/search-field.client';
import { StateBadge } from '@/components/ui/view/state-badge.client';
import { Badge } from '@/components/ui/view/badge.client';
import { BadgeVariant } from '@/components/ui/enums/badge-variant.enum';
import { Avatar } from '@/components/ui/view/avatar.client';
import { Switch } from '@/components/ui/view/switch.client';
import { Button } from '@/components/ui/view/button.client';
import { ButtonVariant } from '@/components/ui/enums/button-variant.enum';
import { KitPlay } from '@/app/kit/view/kit-play.client';
import type { KitDoc } from '@/app/kit/kit-doc';

export class SurfacesKit {
  private static readonly ROWS = [
    { id: '1', name: 'Cotton T-shirt', who: 'Maria', variants: '8 variants', tone: 'success', status: 'Published', note: 'Made of organic cotton, pre-washed, with a round neck and a long enough line to be cut' },
    { id: '2', name: 'Winter jacket', who: 'Ivan', variants: '4 variants', tone: 'warning', status: 'Draft', note: 'Waiting for photographs' },
    { id: '3', name: 'Wool scarf', who: 'Maria', variants: '1 variant', tone: 'danger', status: 'Rejected', note: 'The price is missing' },
  ];

  private static readonly COLUMNS: any[] = [
    { header: 'Product', id: 'name', sortable: true, accessor: (row: any) => <span className="fc-dt-strong">{row.name}</span> },
    { header: 'Note', id: 'note', className: 'fc-dt-fill', accessor: (row: any) => row.note },
    { header: 'Owner', id: 'who', accessor: (row: any) => <span className="fc-dt-who"><Avatar fallback={row.who[0]} size="xsmall" /><span>{row.who}</span></span> },
    { header: 'Variants', id: 'variants', accessor: (row: any) => <span className="fc-dt-quiet">{row.variants}</span> },
    { header: 'Status', id: 'status', accessor: (row: any) => <StateBadge tone={row.tone}>{row.status}</StateBadge> },
  ];

  static docs(): KitDoc[] {
    const menu = <span className="fc-record-card__menu"><FrameworkIcons.More size={15} /></span>;
    return [
      {
        slug: 'card', name: 'Card and RecordCard', group: 'Layout',
        intro: 'The surface things stand on. RecordCard is the card of a record’s page: a head of fixed height (name, count, something beside it, its ⋯) and a body. Card is the bare surface.',
        from: "import { Card, RecordCard } from '@fromcode119/sdk/admin';",
        examples: [
          { title: 'RecordCard', flush: true, demo: <RecordCard title="Details"><dl className="fc-record-card__rows"><div className="fc-record-card__row"><dt className="fc-record-card__label">Handle</dt><dd className="fc-record-card__value">/cotton-t-shirt</dd></div><div className="fc-record-card__row"><dt className="fc-record-card__label">Material</dt><dd className="fc-record-card__value">-</dd></div></dl></RecordCard>, code: '<RecordCard title="Details">\n  …rows…\n</RecordCard>' },
          { title: 'With a count, something beside the name and a menu', flush: true, demo: <RecordCard title="Variants" count={8} aside={<StateBadge tone="success">In stock</StateBadge>} menu={menu}><p className="fc-field-note">Whatever the card holds.</p></RecordCard>, code: '<RecordCard title="Variants" count={8}\n  aside={<StateBadge tone="success">In stock</StateBadge>}\n  menu={<Dropdown … />}>\n  …\n</RecordCard>' },
          { title: 'With a toolbar', flush: true, text: 'A band of its own under the head: what narrows the list at the start, what works on it at the end.', demo: <RecordCard title="Variants" count={8} toolbar={<><Tabs label="Kind" value="all" onChange={() => undefined} tabs={[{ id: 'all', label: 'All' }, { id: 'low', label: 'Low stock' }]} /><Button variant={ButtonVariant.SECONDARY} icon={<FrameworkIcons.Plus size={15} />}>Add</Button></>}><p className="fc-field-note">Whatever the card holds.</p></RecordCard>, code: '<RecordCard title="Variants" count={8} toolbar={<>…</>}>…</RecordCard>' },
          { title: 'Without a head', flush: true, demo: <RecordCard><p className="fc-field-note">A card with no name is body only.</p></RecordCard>, code: '<RecordCard>…</RecordCard>' },
          { title: 'Card', flush: true, text: 'The bare surface, with or without its own padding.', demo: <div className="fc-kitdoc__stack"><Card title="Card" description="A title and a line under it."><p className="fc-field-note">Padded body.</p></Card><Card noPadding><p className="fc-field-note fc-kitdoc__pad">`noPadding`: the content brings its own.</p></Card></div>, code: '<Card title="Card" description="A title and a line under it.">…</Card>\n<Card noPadding>…</Card>' },
        ],
        options: [
          { name: 'title', type: 'string', does: 'The card’s name. Without one there is no head.' },
          { name: 'count', type: 'number | null', does: 'A figure beside the name; 0 is shown, null is not.' },
          { name: 'aside', type: 'ReactNode', does: 'What stands between the name and the ⋯.' },
          { name: 'menu', type: 'ReactNode', does: 'The card’s ⋯.' },
          { name: 'toolbar', type: 'ReactNode', does: 'A band under the head.' },
          { name: 'Card noPadding', type: 'boolean', initial: 'false', does: 'The content brings its own padding.' },
        ],
      },
      {
        slug: 'list-shell', name: 'ListShell', group: 'Layout',
        intro: 'A list as one card: its name and actions in the head, what narrows it and what searches it in a band, the table from edge to edge, a foot. Every list in the console stands in this.',
        from: "import { ListShell, ListShellHead } from '@fromcode119/sdk/admin';",
        examples: [
          { title: 'Name, actions, tabs, search and a table', flush: true, demo: <KitPlay initial="">{(value, set) => <ListShell title="Products" count={3} actions={<><Button variant={ButtonVariant.SECONDARY} icon={<FrameworkIcons.Download size={15} />}>Export</Button><Button variant={ButtonVariant.PRIMARY} icon={<FrameworkIcons.Plus size={15} />}>New product</Button></>} lead={<Tabs label="Kind" value="all" onChange={() => undefined} tabs={[{ id: 'all', label: 'All' }, { id: 'draft', label: 'Draft' }]} />} tools={<SearchField value={value} onChange={set} placeholder="Search" />}><DataTable columns={SurfacesKit.COLUMNS} data={SurfacesKit.ROWS} /></ListShell>}</KitPlay>, code: '<ListShell\n  title="Products" count={3}\n  actions={<Button variant={ButtonVariant.PRIMARY}>New product</Button>}\n  lead={<Tabs … />}\n  tools={<SearchField … />}\n>\n  <DataTable columns={columns} data={rows} />\n</ListShell>' },
          { title: 'Name and table only', flush: true, demo: <ListShell title="Runs" count={3}><DataTable columns={SurfacesKit.COLUMNS} data={SurfacesKit.ROWS} /></ListShell>, code: '<ListShell title="Runs" count={3}>\n  <DataTable … />\n</ListShell>' },
          { title: 'With a line under the name and a foot', flush: true, demo: <ListShell title="Scheduled tasks" subtitle="Open a task to see its recent runs." foot={<Button variant={ButtonVariant.GHOST} icon={<FrameworkIcons.Download size={15} />}>Export</Button>}><DataTable columns={SurfacesKit.COLUMNS} data={SurfacesKit.ROWS.slice(0, 1)} /></ListShell>, code: '<ListShell title="Scheduled tasks" subtitle="Open a task to see its recent runs." foot={…}>…</ListShell>' },
          { title: 'The head alone', flush: true, text: 'ListShellHead is the head by itself, for a list that builds its own bands between the head and the table.', demo: <ListShell><ListShellHead title="Orders" count={128} actions={<Button variant={ButtonVariant.PRIMARY}>New order</Button>} /></ListShell>, code: '<ListShell>\n  <ListShellHead title="Orders" count={128} actions={…} />\n  …own bands…\n</ListShell>' },
        ],
        options: [
          { name: 'title, count, subtitle', type: 'ReactNode, number, ReactNode', does: 'The head: the name, how many, a line under it.' },
          { name: 'actions', type: 'ReactNode', does: 'Buttons at the end of the head, the primary one last.' },
          { name: 'lead', type: 'ReactNode', does: 'Start of the band: Tabs or a Filters button.' },
          { name: 'tools', type: 'ReactNode', does: 'End of the band: the search, the order.' },
          { name: 'children', type: 'ReactNode', does: 'The list itself, edge to edge.' },
          { name: 'foot', type: 'ReactNode', does: 'A band under the list.' },
        ],
      },
      {
        slug: 'data-table', name: 'DataTable', group: 'Data',
        intro: 'The one table. One line a row, 48px; sortable heads, selection, row actions, pages. Below 768px of its own width each row becomes a card.',
        from: "import { DataTable } from '@fromcode119/sdk/admin';",
        examples: [
          { title: 'Plain', flush: true, demo: <ListShell><DataTable columns={SurfacesKit.COLUMNS} data={SurfacesKit.ROWS} /></ListShell>, code: "<DataTable\n  columns={[\n    { header: 'Product', id: 'name', accessor: (row) => row.name },\n    { header: 'Status', id: 'status', accessor: (row) => <StateBadge tone={row.tone}>{row.status}</StateBadge> },\n  ]}\n  data={rows}\n/>" },
          { title: 'What a cell may hold', flush: true, text: 'A cell is plain text unless it needs more. `fc-dt-strong` is the row’s name, `fc-dt-quiet` a second fact, `fc-dt-who` a person with their initial. The column with `className: \'fc-dt-fill\'` takes the spare width and cuts its text; add `fc-dt-wrap` to let it run onto more lines.', demo: <ListShell><DataTable columns={SurfacesKit.COLUMNS} data={SurfacesKit.ROWS.slice(0, 1)} /></ListShell>, code: "{ header: 'Note', id: 'note', className: 'fc-dt-fill', accessor: (row) => row.note }\n{ header: 'Owner', id: 'who', accessor: (row) => (\n  <span className=\"fc-dt-who\"><Avatar fallback={row.who[0]} size=\"xsmall\" /><span>{row.who}</span></span>\n) }" },
          { title: 'Selectable', flush: true, text: 'A box at the start of each row and one for all of them in the head. Pair it with CommandBar.', demo: <KitPlay initial={['1']}>{(value, set) => <ListShell><DataTable columns={SurfacesKit.COLUMNS} data={SurfacesKit.ROWS} selectable selectedIds={value} onSelectionChange={set} /></ListShell>}</KitPlay>, code: '<DataTable selectable selectedIds={selected} onSelectionChange={setSelected} … />' },
          { title: 'Rows that open, with actions', flush: true, text: '`onRowClick` makes the whole row the way into the record; `actions` puts its controls at the end, where they stay while the table scrolls sideways.', demo: <ListShell><DataTable columns={SurfacesKit.COLUMNS} data={SurfacesKit.ROWS} onRowClick={() => undefined} actions={() => <span className="fc-record-card__menu"><FrameworkIcons.More size={15} /></span>} /></ListShell>, code: '<DataTable onRowClick={(row) => open(row)} actions={(row) => <Dropdown … />} … />' },
          { title: 'Sorting and pages', flush: true, text: 'A column with `sortable` gets an arrow; the table says which sort is asked for and the page fetches it. With `totalDocs`, `limit` and `page` the foot shows the count and the pages.', demo: <KitPlay initial={1}>{(value, set) => <ListShell><DataTable columns={SurfacesKit.COLUMNS} data={SurfacesKit.ROWS} currentSort="name" onSort={() => undefined} totalDocs={42} limit={3} page={value} onPageChange={set} /></ListShell>}</KitPlay>, code: '<DataTable currentSort={sort} onSort={setSort}\n  totalDocs={42} limit={20} page={page} onPageChange={setPage} … />' },
          { title: 'In sections', flush: true, demo: <ListShell><DataTable columns={SurfacesKit.COLUMNS} data={SurfacesKit.ROWS} groupBy={(row: any) => row.who} /></ListShell>, code: '<DataTable groupBy={(row) => row.owner} … />' },
          { title: 'Empty and loading', flush: true, demo: <ListShell><DataTable columns={SurfacesKit.COLUMNS} data={[]} emptyMessage="No products yet" /></ListShell>, code: '<DataTable data={[]} emptyMessage="No products yet" … />' },
        ],
        options: [
          { name: 'columns', type: '{ header, id, accessor, sortable?, className? }[]', does: 'The columns. `accessor` is a key of the row or a function giving the cell.' },
          { name: 'data', type: 'row[]', does: 'The rows; each has an `id`.' },
          { name: 'onRowClick', type: '(row) => void', does: 'Makes the row open something.' },
          { name: 'actions', type: '(row) => ReactNode', does: 'Controls at the end of each row.' },
          { name: 'selectable, selectedIds, onSelectionChange', type: 'boolean, string[], (ids) => void', does: 'Selection.' },
          { name: 'currentSort, onSort', type: 'string, (sort) => void', does: 'Sorting by a sortable column.' },
          { name: 'totalDocs, limit, page, onPageChange', type: 'numbers, (page) => void', does: 'The foot: the count and the pages.' },
          { name: 'groupBy / sections', type: '(row) => string / section[]', does: 'Rows under headings.' },
          { name: 'emptyMessage', type: 'string', does: 'What it says with no rows.' },
          { name: 'stickyColumnIds, stickyActions', type: 'string[], boolean', does: 'Columns and actions that stay while it scrolls sideways.' },
          { name: 'cards', type: 'boolean', initial: 'true', does: 'Rows become cards when the table is narrow.' },
          { name: 'rowClassName', type: '(row) => string', does: 'A class on a row.' },
        ],
      },
      {
        slug: 'list-row', name: 'ListCard and ListRow', group: 'Data',
        intro: 'A list of installed or named things — plugins, themes, people — where each row is a thing with its state and its controls, not a line of columns.',
        from: "import { ListCard, ListRow } from '@fromcode119/sdk/admin';",
        examples: [
          { title: 'Rows', flush: true, demo: <ListCard><ListRow icon={<FrameworkIcons.Plugins size={16} />} title={<span>Finance Core</span>} badges={<Badge variant={BadgeVariant.WARNING}>Waiting for approval</Badge>} description="Wallets, gift cards and the transaction ledger." meta="v0.1.172 · Fromcode Core" actions={<Switch checked={false} onChange={() => undefined} />} menu={[{ label: 'Details', onClick: () => undefined }]} /><ListRow initials="K" title={<span>Kristian</span>} badges={<Badge variant={BadgeVariant.SUCCESS}>Administrator</Badge>} description="kristian@example.com" meta="Joined 19.11.2026" actions={<Button variant={ButtonVariant.SECONDARY}>Create login</Button>} /><ListRow icon={<FrameworkIcons.Plugins size={16} />} title={<span>E-commerce Suite</span>} badges={<Badge variant={BadgeVariant.DANGER}>Error</Badge>} description="The plugin failed to start." failed meta="v0.1.480" /></ListCard>, code: '<ListCard>\n  <ListRow\n    icon={<FrameworkIcons.Plugins size={16} />}\n    title="Finance Core"\n    badges={<Badge variant={BadgeVariant.WARNING}>Waiting for approval</Badge>}\n    description="Wallets, gift cards and the transaction ledger."\n    meta="v0.1.172 · Fromcode Core"\n    actions={<Switch … />}\n    menu={[{ label: \'Details\', onClick }]}\n  />\n</ListCard>' },
          { title: 'Empty', flush: true, demo: <ListCard empty="No plugins installed." />, code: '<ListCard empty="No plugins installed." />' },
        ],
        options: [
          { name: 'lead', type: 'ReactNode', does: 'What stands before the icon: a tick, when rows can be chosen.' },
          { name: 'icon / initials', type: 'ReactNode / string', does: 'What stands before the name: an icon, or a person’s initial.' },
          { name: 'title, badges', type: 'ReactNode', does: 'The name and the states beside it.' },
          { name: 'description, failed', type: 'ReactNode, boolean', does: 'One line under the name; `failed` turns it to the danger tone.' },
          { name: 'meta', type: 'string', does: 'A quiet fact before the controls; hidden on a phone.' },
          { name: 'actions, menu', type: 'ReactNode, item[]', does: 'The row’s controls and its ⋯.' },
          { name: 'ListCard empty', type: 'ReactNode', does: 'What the card says with no rows.' },
        ],
      },
      {
        slug: 'page-bar', name: 'PageBar', group: 'Layout',
        intro: 'The bar over a page’s content when that content is not one list card: what narrows it at the start, the search and the page’s action at the end.',
        from: "import { PageBar } from '@fromcode119/sdk/admin';",
        examples: [
          { title: 'Tabs, search and an action', demo: <div className="fc-kitdoc__cell--wide"><KitPlay initial="">{(value, set) => <PageBar lead={<Tabs label="Filter" value="all" onChange={() => undefined} tabs={[{ id: 'all', label: 'All', count: 2 }, { id: 'active', label: 'Active', count: 1 }]} />}><SearchField value={value} onChange={set} placeholder="Search" /><Button variant={ButtonVariant.PRIMARY} icon={<FrameworkIcons.Upload size={15} />}>Upload</Button></PageBar>}</KitPlay></div>, code: '<PageBar lead={<Tabs … />}>\n  <SearchField … />\n  <Button variant={ButtonVariant.PRIMARY}>Upload</Button>\n</PageBar>' },
        ],
        options: [
          { name: 'lead', type: 'ReactNode', does: 'The start of the bar.' },
          { name: 'children', type: 'ReactNode', does: 'The tools at its end.' },
        ],
      },
      {
        slug: 'state-page', name: 'StatePage', group: 'Feedback',
        intro: 'A whole page with nothing to show: not found, not allowed, failed to load.',
        from: "import { StatePage } from '@fromcode119/sdk/admin';",
        examples: [
          { title: 'With a way out', demo: <div className="fc-kitdoc__cell--wide fc-kit__state"><StatePage icon={<FrameworkIcons.Search size={18} />} title="Product not found" hint="It may have been deleted, or the address is wrong." actions={<Button variant={ButtonVariant.SECONDARY}>Back to products</Button>} /></div>, code: '<StatePage\n  title="Product not found"\n  hint="It may have been deleted, or the address is wrong."\n  actions={<Button variant={ButtonVariant.SECONDARY}>Back to products</Button>}\n/>' },
        ],
        options: [
          { name: 'title', type: 'string', does: 'What happened.' },
          { name: 'hint', type: 'ReactNode', does: 'Why, or what to do.' },
          { name: 'icon, actions', type: 'ReactNode', does: 'An icon over the title; the ways out under it.' },
        ],
      },
    ];
  }
}
