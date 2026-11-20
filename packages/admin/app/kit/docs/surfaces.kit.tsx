import { KitCopy } from '@/app/kit/kit-copy';
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
        slug: 'card', name: 'Card and RecordCard', group: KitCopy.t('docs.surfaces.layout'),
        intro: KitCopy.t('docs.surfaces.theSurfaceThingsStandOn'),
        from: "import { Card, RecordCard } from '@fromcode119/sdk/admin';",
        examples: [
          { title: KitCopy.t('docs.surfaces.recordcard'), flush: true, demo: <RecordCard title={KitCopy.t('docs.surfaces.details')}><dl className="fc-record-card__rows"><div className="fc-record-card__row"><dt className="fc-record-card__label">{KitCopy.t('docs.surfaces.handle')}</dt><dd className="fc-record-card__value">/cotton-t-shirt</dd></div><div className="fc-record-card__row"><dt className="fc-record-card__label">{KitCopy.t('docs.surfaces.material')}</dt><dd className="fc-record-card__value">-</dd></div></dl></RecordCard>, code: '<RecordCard title="Details">\n  …rows…\n</RecordCard>' },
          { title: KitCopy.t('docs.surfaces.withACountSomethingBeside'), flush: true, demo: <RecordCard title={KitCopy.t('docs.surfaces.variants')} count={8} aside={<StateBadge tone="success">{KitCopy.t('docs.surfaces.inStock')}</StateBadge>} menu={menu}><p className="fc-field-note">{KitCopy.t('docs.surfaces.whateverTheCardHolds')}</p></RecordCard>, code: '<RecordCard title="Variants" count={8}\n  aside={<StateBadge tone="success">In stock</StateBadge>}\n  menu={<Dropdown … />}>\n  …\n</RecordCard>' },
          { title: KitCopy.t('docs.surfaces.withAToolbar'), flush: true, text: KitCopy.t('docs.surfaces.aBandOfItsOwn'), demo: <RecordCard title={KitCopy.t('docs.surfaces.variants')} count={8} toolbar={<><Tabs label={KitCopy.t('docs.surfaces.kind')} value="all" onChange={() => undefined} tabs={[{ id: 'all', label: KitCopy.t('docs.surfaces.all') }, { id: 'low', label: KitCopy.t('docs.surfaces.lowStock') }]} /><Button variant={ButtonVariant.SECONDARY} icon={<FrameworkIcons.Plus size={15} />}>{KitCopy.t('docs.surfaces.add')}</Button></>}><p className="fc-field-note">{KitCopy.t('docs.surfaces.whateverTheCardHolds')}</p></RecordCard>, code: '<RecordCard title="Variants" count={8} toolbar={<>…</>}>…</RecordCard>' },
          { title: KitCopy.t('docs.surfaces.withoutAHead'), flush: true, demo: <RecordCard><p className="fc-field-note">{KitCopy.t('docs.surfaces.aCardWithNoName')}</p></RecordCard>, code: '<RecordCard>…</RecordCard>' },
          { title: KitCopy.t('docs.surfaces.card'), flush: true, text: KitCopy.t('docs.surfaces.theBareSurfaceWithOr'), demo: <div className="fc-kitdoc__stack"><Card title={KitCopy.t('docs.surfaces.card')} description={KitCopy.t('docs.surfaces.aTitleAndALine')}><p className="fc-field-note">{KitCopy.t('docs.surfaces.paddedBody')}</p></Card><Card noPadding><p className="fc-field-note fc-kitdoc__pad">{KitCopy.t('docs.surfaces.nopaddingTheContentBringsIts')}</p></Card></div>, code: '<Card title="Card" description="A title and a line under it.">…</Card>\n<Card noPadding>…</Card>' },
          { title: KitCopy.t('docs.surfaces.cardWithActions'), flush: true, text: KitCopy.t('docs.surfaces.actionsStandAtTheEnd'), demo: <Card title={KitCopy.t('docs.surfaces.process')} description={KitCopy.t('docs.surfaces.whatThisPluginRunsAnd')} actions={<Button variant={ButtonVariant.SECONDARY} icon={<FrameworkIcons.Refresh size={14} />}>{KitCopy.t('docs.surfaces.refresh')}</Button>}><p className="fc-field-note">{KitCopy.t('docs.surfaces.whateverTheCardHolds')}</p></Card>, code: '<Card title="Process" description="…"\n  actions={<Button variant={ButtonVariant.SECONDARY} icon={<FrameworkIcons.Refresh size={14} />}>Refresh</Button>}>\n  …\n</Card>' },
        ],
        options: [
          { name: 'title', type: 'string', does: KitCopy.t('docs.surfaces.theCardSNameWithout') },
          { name: 'count', type: 'number | null', does: KitCopy.t('docs.surfaces.aFigureBesideTheName') },
          { name: 'aside', type: 'ReactNode', does: KitCopy.t('docs.surfaces.whatStandsBetweenTheName') },
          { name: 'menu', type: 'ReactNode', does: KitCopy.t('docs.surfaces.theCardS') },
          { name: 'toolbar', type: 'ReactNode', does: KitCopy.t('docs.surfaces.aBandUnderTheHead') },
          { name: 'Card noPadding', type: 'boolean', initial: 'false', does: KitCopy.t('docs.surfaces.theContentBringsItsOwn') },
          { name: 'Card actions', type: 'ReactNode', does: KitCopy.t('docs.surfaces.buttonsAtTheEndOf') },
        ],
      },
      {
        slug: 'list-shell', name: 'ListShell', group: KitCopy.t('docs.surfaces.layout'),
        intro: KitCopy.t('docs.surfaces.aListAsOneCard'),
        from: "import { ListShell, ListShellHead } from '@fromcode119/sdk/admin';",
        examples: [
          { title: KitCopy.t('docs.surfaces.nameActionsTabsSearchAnd'), flush: true, demo: <KitPlay initial="">{(value, set) => <ListShell title={KitCopy.t('docs.surfaces.products')} count={3} actions={<><Button variant={ButtonVariant.SECONDARY} icon={<FrameworkIcons.Download size={15} />}>{KitCopy.t('docs.surfaces.export')}</Button><Button variant={ButtonVariant.PRIMARY} icon={<FrameworkIcons.Plus size={15} />}>{KitCopy.t('docs.surfaces.newProduct')}</Button></>} lead={<Tabs label={KitCopy.t('docs.surfaces.kind')} value="all" onChange={() => undefined} tabs={[{ id: 'all', label: KitCopy.t('docs.surfaces.all') }, { id: 'draft', label: KitCopy.t('docs.surfaces.draft') }]} />} tools={<SearchField value={value} onChange={set} placeholder={KitCopy.t('docs.surfaces.search')} />}><DataTable columns={SurfacesKit.COLUMNS} data={SurfacesKit.ROWS} /></ListShell>}</KitPlay>, code: '<ListShell\n  title="Products" count={3}\n  actions={<Button variant={ButtonVariant.PRIMARY}>New product</Button>}\n  lead={<Tabs … />}\n  tools={<SearchField … />}\n>\n  <DataTable columns={columns} data={rows} />\n</ListShell>' },
          { title: KitCopy.t('docs.surfaces.nameAndTableOnly'), flush: true, demo: <ListShell title={KitCopy.t('docs.surfaces.runs')} count={3}><DataTable columns={SurfacesKit.COLUMNS} data={SurfacesKit.ROWS} /></ListShell>, code: '<ListShell title="Runs" count={3}>\n  <DataTable … />\n</ListShell>' },
          { title: KitCopy.t('docs.surfaces.withALineUnderThe'), flush: true, demo: <ListShell title={KitCopy.t('docs.surfaces.scheduledTasks')} subtitle="Open a task to see its recent runs." foot={<Button variant={ButtonVariant.GHOST} icon={<FrameworkIcons.Download size={15} />}>{KitCopy.t('docs.surfaces.export')}</Button>}><DataTable columns={SurfacesKit.COLUMNS} data={SurfacesKit.ROWS.slice(0, 1)} /></ListShell>, code: '<ListShell title="Scheduled tasks" subtitle="Open a task to see its recent runs." foot={…}>…</ListShell>' },
          { title: KitCopy.t('docs.surfaces.theHeadAlone'), flush: true, text: KitCopy.t('docs.surfaces.listshellheadIsTheHeadBy'), demo: <ListShell><ListShellHead title={KitCopy.t('docs.surfaces.orders')} count={128} actions={<Button variant={ButtonVariant.PRIMARY}>{KitCopy.t('docs.surfaces.newOrder')}</Button>} /></ListShell>, code: '<ListShell>\n  <ListShellHead title="Orders" count={128} actions={…} />\n  …own bands…\n</ListShell>' },
        ],
        options: [
          { name: 'title, count, subtitle', type: 'ReactNode, number, ReactNode', does: KitCopy.t('docs.surfaces.theHeadTheNameHow') },
          { name: 'actions', type: 'ReactNode', does: KitCopy.t('docs.surfaces.buttonsAtTheEndOf2') },
          { name: 'lead', type: 'ReactNode', does: KitCopy.t('docs.surfaces.startOfTheBandTabs') },
          { name: 'tools', type: 'ReactNode', does: KitCopy.t('docs.surfaces.endOfTheBandThe') },
          { name: 'children', type: 'ReactNode', does: KitCopy.t('docs.surfaces.theListItselfEdgeTo') },
          { name: 'foot', type: 'ReactNode', does: KitCopy.t('docs.surfaces.aBandUnderTheList') },
        ],
      },
      {
        slug: 'data-table', name: 'DataTable', group: KitCopy.t('docs.surfaces.data'),
        intro: KitCopy.t('docs.surfaces.theOneTableOneLine'),
        from: "import { DataTable } from '@fromcode119/sdk/admin';",
        examples: [
          { title: KitCopy.t('docs.surfaces.plain'), flush: true, demo: <ListShell><DataTable columns={SurfacesKit.COLUMNS} data={SurfacesKit.ROWS} /></ListShell>, code: "<DataTable\n  columns={[\n    { header: 'Product', id: 'name', accessor: (row) => row.name },\n    { header: 'Status', id: 'status', accessor: (row) => <StateBadge tone={row.tone}>{row.status}</StateBadge> },\n  ]}\n  data={rows}\n/>" },
          { title: KitCopy.t('docs.surfaces.whatACellMayHold'), flush: true, text: KitCopy.t('docs.surfaces.aCellIsPlainText'), demo: <ListShell><DataTable columns={SurfacesKit.COLUMNS} data={SurfacesKit.ROWS.slice(0, 1)} /></ListShell>, code: "{ header: 'Note', id: 'note', className: 'fc-dt-fill', accessor: (row) => row.note }\n{ header: 'Owner', id: 'who', accessor: (row) => (\n  <span className=\"fc-dt-who\"><Avatar fallback={row.who[0]} size=\"xsmall\" /><span>{row.who}</span></span>\n) }" },
          { title: KitCopy.t('docs.surfaces.selectable'), flush: true, text: KitCopy.t('docs.surfaces.aBoxAtTheStart'), demo: <KitPlay initial={['1']}>{(value, set) => <ListShell><DataTable columns={SurfacesKit.COLUMNS} data={SurfacesKit.ROWS} selectable selectedIds={value} onSelectionChange={set} /></ListShell>}</KitPlay>, code: '<DataTable selectable selectedIds={selected} onSelectionChange={setSelected} … />' },
          { title: KitCopy.t('docs.surfaces.rowsThatOpenWithActions'), flush: true, text: KitCopy.t('docs.surfaces.onrowclickMakesTheWholeRow'), demo: <ListShell><DataTable columns={SurfacesKit.COLUMNS} data={SurfacesKit.ROWS} onRowClick={() => undefined} actions={() => <span className="fc-record-card__menu"><FrameworkIcons.More size={15} /></span>} /></ListShell>, code: '<DataTable onRowClick={(row) => open(row)} actions={(row) => <Dropdown … />} … />' },
          { title: KitCopy.t('docs.surfaces.sortingAndPages'), flush: true, text: KitCopy.t('docs.surfaces.aColumnWithSortableGets'), demo: <KitPlay initial={1}>{(value, set) => <ListShell><DataTable columns={SurfacesKit.COLUMNS} data={SurfacesKit.ROWS} currentSort="name" onSort={() => undefined} totalDocs={42} limit={3} page={value} onPageChange={set} /></ListShell>}</KitPlay>, code: '<DataTable currentSort={sort} onSort={setSort}\n  totalDocs={42} limit={20} page={page} onPageChange={setPage} … />' },
          { title: KitCopy.t('docs.surfaces.inSections'), flush: true, demo: <ListShell><DataTable columns={SurfacesKit.COLUMNS} data={SurfacesKit.ROWS} groupBy={(row: any) => row.who} /></ListShell>, code: '<DataTable groupBy={(row) => row.owner} … />' },
          { title: KitCopy.t('docs.surfaces.emptyAndLoading'), flush: true, demo: <ListShell><DataTable columns={SurfacesKit.COLUMNS} data={[]} emptyMessage="No products yet" /></ListShell>, code: '<DataTable data={[]} emptyMessage="No products yet" … />' },
        ],
        options: [
          { name: 'columns', type: '{ header, id, accessor, sortable?, className? }[]', does: KitCopy.t('docs.surfaces.theColumnsAccessorIsA') },
          { name: 'data', type: 'row[]', does: KitCopy.t('docs.surfaces.theRowsEachHasAn') },
          { name: 'onRowClick', type: '(row) => void', does: KitCopy.t('docs.surfaces.makesTheRowOpenSomething') },
          { name: 'actions', type: '(row) => ReactNode', does: KitCopy.t('docs.surfaces.controlsAtTheEndOf') },
          { name: 'selectable, selectedIds, onSelectionChange', type: 'boolean, string[], (ids) => void', does: KitCopy.t('docs.surfaces.selection') },
          { name: 'currentSort, onSort', type: 'string, (sort) => void', does: KitCopy.t('docs.surfaces.sortingByASortableColumn') },
          { name: 'totalDocs, limit, page, onPageChange', type: 'numbers, (page) => void', does: KitCopy.t('docs.surfaces.theFootTheCountAnd') },
          { name: 'groupBy / sections', type: '(row) => string / section[]', does: KitCopy.t('docs.surfaces.rowsUnderHeadings') },
          { name: 'emptyMessage', type: 'string', does: KitCopy.t('docs.surfaces.whatItSaysWithNo') },
          { name: 'stickyColumnIds, stickyActions', type: 'string[], boolean', does: KitCopy.t('docs.surfaces.columnsAndActionsThatStay') },
          { name: 'cards', type: 'boolean', initial: 'true', does: KitCopy.t('docs.surfaces.rowsBecomeCardsWhenThe') },
          { name: 'rowClassName', type: '(row) => string', does: KitCopy.t('docs.surfaces.aClassOnARow') },
        ],
      },
      {
        slug: 'list-row', name: 'ListCard and ListRow', group: KitCopy.t('docs.surfaces.data'),
        intro: KitCopy.t('docs.surfaces.aListOfInstalledOr'),
        from: "import { ListCard, ListRow } from '@fromcode119/sdk/admin';",
        examples: [
          { title: KitCopy.t('docs.surfaces.rows'), flush: true, demo: <ListCard><ListRow icon={<FrameworkIcons.Plugins size={16} />} title={<span>{KitCopy.t('docs.surfaces.financeCore')}</span>} badges={<Badge variant={BadgeVariant.WARNING}>{KitCopy.t('docs.surfaces.waitingForApproval')}</Badge>} description={KitCopy.t('docs.surfaces.walletsGiftCardsAndThe')} meta="v0.1.172 · Fromcode Core" actions={<Switch checked={false} onChange={() => undefined} />} menu={[{ label: KitCopy.t('docs.surfaces.details'), onClick: () => undefined }]} /><ListRow initials="K" title={<span>{KitCopy.t('docs.surfaces.kristian')}</span>} badges={<Badge variant={BadgeVariant.SUCCESS}>{KitCopy.t('docs.surfaces.administrator')}</Badge>} description={KitCopy.t('docs.surfaces.kristianExampleCom')} meta="Joined 19.11.2026" actions={<Button variant={ButtonVariant.SECONDARY}>{KitCopy.t('docs.surfaces.createLogin')}</Button>} /><ListRow icon={<FrameworkIcons.Plugins size={16} />} title={<span>{KitCopy.t('docs.surfaces.eCommerceSuite')}</span>} badges={<Badge variant={BadgeVariant.DANGER}>{KitCopy.t('docs.surfaces.error')}</Badge>} description={KitCopy.t('docs.surfaces.thePluginFailedToStart')} failed meta="v0.1.480" /></ListCard>, code: '<ListCard>\n  <ListRow\n    icon={<FrameworkIcons.Plugins size={16} />}\n    title="Finance Core"\n    badges={<Badge variant={BadgeVariant.WARNING}>Waiting for approval</Badge>}\n    description="Wallets, gift cards and the transaction ledger."\n    meta="v0.1.172 · Fromcode Core"\n    actions={<Switch … />}\n    menu={[{ label: \'Details\', onClick }]}\n  />\n</ListCard>' },
          { title: KitCopy.t('docs.surfaces.empty'), flush: true, demo: <ListCard empty="No plugins installed." />, code: '<ListCard empty="No plugins installed." />' },
        ],
        options: [
          { name: 'lead', type: 'ReactNode', does: KitCopy.t('docs.surfaces.whatStandsBeforeTheIcon') },
          { name: 'icon / initials', type: 'ReactNode / string', does: KitCopy.t('docs.surfaces.whatStandsBeforeTheName') },
          { name: 'title, badges', type: 'ReactNode', does: KitCopy.t('docs.surfaces.theNameAndTheStates') },
          { name: 'description, failed', type: 'ReactNode, boolean', does: KitCopy.t('docs.surfaces.oneLineUnderTheName') },
          { name: 'meta', type: 'string', does: KitCopy.t('docs.surfaces.aQuietFactBeforeThe') },
          { name: 'actions, menu', type: 'ReactNode, item[]', does: KitCopy.t('docs.surfaces.theRowSControlsAnd') },
          { name: 'ListCard empty', type: 'ReactNode', does: KitCopy.t('docs.surfaces.whatTheCardSaysWith') },
        ],
      },
      {
        slug: 'page-bar', name: 'PageBar', group: KitCopy.t('docs.surfaces.layout'),
        intro: KitCopy.t('docs.surfaces.theBarOverAPage'),
        from: "import { PageBar } from '@fromcode119/sdk/admin';",
        examples: [
          { title: KitCopy.t('docs.surfaces.tabsSearchAndAnAction'), demo: <div className="fc-kitdoc__cell--wide"><KitPlay initial="">{(value, set) => <PageBar lead={<Tabs label={KitCopy.t('docs.surfaces.filter')} value="all" onChange={() => undefined} tabs={[{ id: 'all', label: KitCopy.t('docs.surfaces.all'), count: 2 }, { id: 'active', label: KitCopy.t('docs.surfaces.active'), count: 1 }]} />}><SearchField value={value} onChange={set} placeholder={KitCopy.t('docs.surfaces.search')} /><Button variant={ButtonVariant.PRIMARY} icon={<FrameworkIcons.Upload size={15} />}>{KitCopy.t('docs.surfaces.upload')}</Button></PageBar>}</KitPlay></div>, code: '<PageBar lead={<Tabs … />}>\n  <SearchField … />\n  <Button variant={ButtonVariant.PRIMARY}>Upload</Button>\n</PageBar>' },
        ],
        options: [
          { name: 'lead', type: 'ReactNode', does: KitCopy.t('docs.surfaces.theStartOfTheBar') },
          { name: 'children', type: 'ReactNode', does: KitCopy.t('docs.surfaces.theToolsAtItsEnd') },
        ],
      },
      {
        slug: 'state-page', name: 'StatePage', group: KitCopy.t('docs.surfaces.feedback'),
        intro: KitCopy.t('docs.surfaces.aWholePageWithNothing'),
        from: "import { StatePage } from '@fromcode119/sdk/admin';",
        examples: [
          { title: KitCopy.t('docs.surfaces.withAWayOut'), demo: <div className="fc-kitdoc__cell--wide fc-kit__state"><StatePage icon={<FrameworkIcons.Search size={18} />} title={KitCopy.t('docs.surfaces.productNotFound')} hint={KitCopy.t('docs.surfaces.itMayHaveBeenDeleted')} actions={<Button variant={ButtonVariant.SECONDARY}>{KitCopy.t('docs.surfaces.backToProducts')}</Button>} /></div>, code: '<StatePage\n  title="Product not found"\n  hint="It may have been deleted, or the address is wrong."\n  actions={<Button variant={ButtonVariant.SECONDARY}>Back to products</Button>}\n/>' },
        ],
        options: [
          { name: 'title', type: 'string', does: KitCopy.t('docs.surfaces.whatHappened') },
          { name: 'hint', type: 'ReactNode', does: KitCopy.t('docs.surfaces.whyOrWhatToDo') },
          { name: 'icon, actions', type: 'ReactNode', does: KitCopy.t('docs.surfaces.anIconOverTheTitle') },
        ],
      },
    ];
  }
}
