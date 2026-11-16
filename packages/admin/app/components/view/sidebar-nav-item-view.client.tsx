import type { ReactElement, ReactNode, RefObject } from 'react';
import { AdminLink } from '@/components/view/admin-link.client';
import { PureReactor, prop, ref, state, Platform } from '@fromcode119/react-class-components';
import { FrameworkIcons, Slot } from '@fromcode119/react';
import { NavSectionPages } from '@/lib/nav-section-pages';
import { NavGroupPanel } from '@/app/components/view/nav-group-panel.client';
import { NavUtils } from '@/lib/nav-utils';
import { AdminNavText } from '@/lib/i18n/admin-nav-text';

/**
 * One section of the console's menu, and — only while you are inside it — the pages under it.
 *
 * Nothing opens or closes by hand and nothing is remembered: a section's pages show, indented under
 * it, exactly while the current page is one of them, and are gone the moment you go elsewhere. The
 * look is `admin.css` (`fc-nav-*`), never spelled out here.
 */
export class NavItemView extends PureReactor {
  @prop declare icon?: ReactNode;
  @prop declare label: string;
  @prop declare href: string;
  @prop declare active?: boolean;
  @prop declare onClick?: () => void;
  /** The section's own pages (a plugin's menu entries). */
  @prop declare children?: any[];
  /** More pages of this section (its panel entries), drawn after its own while it is open. */
  @prop declare subItems?: any[];
  @prop declare isMini?: boolean;
  /** The plugin that registered this item; only it may fill the item's trailing slot. */
  @prop declare pluginSlug?: string;
  /** The letter this section answers to after G. Printed on the row, so the key is never a secret. */
  @prop declare shortcut?: string;
  /**
   * The section's pages stand in the second column beside the menu on a desktop — Settings, pinned at
   * the menu's foot, where twenty pages opened under it pushed every other section out of the sidebar.
   * The phone's menu keeps them under the line.
   */
  @prop declare paneled?: boolean;
  /** The page the current one belongs to, when a page is reached from a section's page (a record of a list). */
  @prop declare activePathOverride?: string;
  /** Raw pathname from `usePathname()`, supplied by the thin functional shim. */
  @prop declare rawPathname: string | null;

  @ref declare private sectionRef: RefObject<HTMLDivElement | null>;

  // An open section's pages can fall below the menu's fold (Settings sits at its foot); bring the whole
  // section into view, moving the menu only as far as needed.
  /** The sub-menu shown OVER the content while the pointer rests on it (desktop). */
  @state private previewGroup = '';
  private previewTimer = 0;
  private static readonly PREVIEW_EVENT = 'fc-nav-group-preview';
  /** The preview key of a paneled section's own pages (a group is keyed by its name). */
  private static readonly SECTION_PREVIEW = ':section';

  componentDidMount(): void {
    this.revealWhenOpen();
    // One preview on screen: a group opening its pages closes any other section's.
    this.listen(window, NavItemView.PREVIEW_EVENT, (event: Event) => {
      if ((event as CustomEvent).detail !== this) this.closePreviewNow();
    });
  }

  componentWillUnmount(): void {
    window.clearTimeout(this.previewTimer);
  }

  private openPreview(name: string): void {
    window.clearTimeout(this.previewTimer);
    this.previewTimer = window.setTimeout(() => {
      window.dispatchEvent(new CustomEvent(NavItemView.PREVIEW_EVENT, { detail: this }));
      this.previewGroup = name;
    }, 80);
  }

  /** Left with a short grace, so the pointer can cross from the group line into its column. */
  private closePreview = (): void => {
    window.clearTimeout(this.previewTimer);
    this.previewTimer = window.setTimeout(() => this.closePreviewNow(), 220);
  };

  private keepPreview = (): void => {
    window.clearTimeout(this.previewTimer);
  };

  private closePreviewNow(): void {
    window.clearTimeout(this.previewTimer);
    if (this.previewGroup) this.previewGroup = '';
  }

  componentDidUpdate(): void {
    this.revealWhenOpen();
  }

  /** The page the section was last revealed for, so a re-render never drags back a menu scrolled by hand. */
  private revealedFor = '';

  private revealWhenOpen(): void {
    const node = this.sectionRef.current;
    const page = this.rawPathname || '';
    if (!Platform.isBrowser || !node || this.isMini || !node.querySelector('.fc-nav-sub')) {
      this.revealedFor = '';
      return;
    }
    if (this.revealedFor === page) return;
    this.revealedFor = page;
    node.scrollIntoView({ block: 'nearest' });
  }

  private get pages(): any[] {
    const seen = new Set<string>();
    return [...(this.children || []), ...(this.subItems || [])].filter((page) => {
      const path = NavUtils.normalizePath(page?.path);
      if (!path || seen.has(path)) return false;
      seen.add(path);
      return true;
    });
  }

  /**
   * Which page of this section is open. The page the URL itself names wins; the override only decides
   * the cases the URL cannot — a page reached from another section, where the panel says which section
   * it belongs to. It used to be the other way round, and because a section's own landing page is one of
   * its pages, the override `/finance` matched first: standing on /finance/currencies the menu marked
   * "Overview" and left the sub-menu holding Currencies shut, so that sub-menu looked like it did nothing.
   */
  /**
   * Where the section's own row goes: its declared page, or its first one when that page is not among
   * the pages it has. A section whose landing page is withheld in this scope — the accounts list,
   * which belongs to the platform and is dropped inside a site — would otherwise open the one screen
   * the menu just decided not to offer.
   */
  private openingHref(pages: any[]): string {
    const declared = NavUtils.normalizePath(this.href);
    if (!pages.length || !declared) return this.href;
    const has = pages.some((page) => NavUtils.normalizePath(page?.path) === declared);
    return has ? this.href : (String(pages[0]?.path || '') || this.href);
  }

  private activePagePath(pages: any[]): string {
    const paths = pages.map((page) => NavUtils.normalizePath(page.path)).filter(Boolean) as string[];
    const matched = NavUtils.resolveBestMatchPath(this.rawPathname || '', paths) || '';
    if (matched && matched !== NavUtils.normalizePath(this.href)) return matched;
    const override = NavUtils.normalizePath(this.activePathOverride);
    if (override && paths.includes(override)) return override;
    return matched;
  }

  render(): ReactElement {
    const { icon, label, onClick, isMini } = this;
    const pages = this.pages;
    const href = this.openingHref(pages);
    const activePage = this.activePagePath(pages);
    const open = Boolean(this.active || activePage);
    const nav = 'fc-nav-item';
    const state = open ? ` ${nav}--active` : '';

    const paneled = Boolean(this.paneled) && !isMini && pages.length > 0;
    const previewing = paneled && !open && this.previewGroup === NavItemView.SECTION_PREVIEW;
    return (
      <div className="fc-nav-section" ref={this.sectionRef}>
        <AdminLink
          href={href}
          onClick={paneled ? () => { this.closePreviewNow(); onClick?.(); } : onClick}
          onMouseEnter={paneled ? () => this.openPreview(NavItemView.SECTION_PREVIEW) : undefined}
          onMouseLeave={paneled ? this.closePreview : undefined}
          // Collapsed, the icon is the ONLY thing on screen, so the name lives in the tooltip and in the
          // accessible name instead.
          title={isMini ? label : undefined}
          aria-label={isMini ? label : undefined}
          aria-current={open && !activePage ? 'page' : undefined}
          aria-expanded={paneled ? open || previewing : undefined}
          className={`${nav}${isMini ? ` ${nav}--mini` : ''}${state}${previewing ? ` ${nav}--preview` : ''}`}
        >
          <span className={`${nav}__icon`}>{icon}</span>
          {!isMini ? <span className={`${nav}__label`}>{label}</span> : null}
          {!isMini && this.shortcut ? <kbd className={`${nav}__kbd`} aria-hidden="true">G {this.shortcut.toUpperCase()}</kbd> : null}
          {this.renderTrailing(href, open, !!isMini)}
        </AdminLink>

        {open && !isMini && pages.length > 0 ? (
          <div className={`fc-nav-sub${paneled ? ' fc-nav-sub--paneled' : ''}`}>
            {NavSectionPages.arrange(pages, label).map((entry) => (entry.kind === 'page'
              ? this.renderPage(entry.page, activePage)
              : this.renderGroup(entry, activePage)))}
          </div>
        ) : null}
        {paneled && (open || previewing) ? (
          <NavGroupPanel title={label} preview={previewing} onPointerEnter={this.keepPreview} onPointerLeave={this.closePreview}>
            {NavSectionPages.arrange(pages, label).map((entry) => (entry.kind === 'page'
              ? this.renderPage(entry.page, activePage)
              : this.renderPanelGroup(entry, activePage)))}
          </NavGroupPanel>
        ) : null}
      </div>
    );
  }

  private renderPage(page: any, activePage: string, nested = false): ReactNode {
    const path = NavUtils.normalizePath(page.path);
    const current = path === activePage;
    return (
      <AdminLink
        key={path}
        href={page.path}
        onClick={this.onClick}
        aria-current={current ? 'page' : undefined}
        className={`fc-nav-sub__item${nested ? ' fc-nav-sub__item--nested' : ''}${current ? ' fc-nav-sub__item--active' : ''}`}
      >
        <span className="fc-nav-sub__label">{page.sourcePlugin ? AdminNavText.panelLabel(page) : AdminNavText.menuLabel(page)}</span>
        {this.renderTrailing(page.path, current, false)}
      </AdminLink>
    );
  }

  /**
   * A sub-menu: one line whose name leads to its first page. On a desktop its pages stand in a second
   * column beside the menu — kept while one of them is open, shown over the content while the pointer is
   * on the line. In the phone's menu the same pages sit under the line while one of them is open.
   */
  private renderGroup(entry: { name: string; pages: any[]; href?: string }, activePage: string): ReactNode {
    const open = NavSectionPages.holds(entry, activePage);
    const previewing = !open && this.previewGroup === entry.name;
    const pages = (nested: boolean) => entry.pages.map((page) => this.renderPage(page, activePage, nested));
    return (
      <div key={`group:${entry.name}`} className={`fc-nav-sub__group${open ? ' fc-nav-sub__group--open' : ''}${previewing ? ' fc-nav-sub__group--preview' : ''}`}>
        <AdminLink
          href={entry.href || entry.pages[0].path}
          onClick={() => { this.closePreviewNow(); this.onClick?.(); }}
          onMouseEnter={() => this.openPreview(entry.name)}
          onMouseLeave={this.closePreview}
          aria-expanded={open || previewing}
          className={`fc-nav-sub__item fc-nav-sub__item--group${open ? ' fc-nav-sub__item--current' : ''}`}
        >
          <span className="fc-nav-sub__label">{entry.name}</span>
          <span className="fc-nav-sub__chevron" aria-hidden="true"><FrameworkIcons.ChevronRight size={14} /></span>
        </AdminLink>
        {open ? <div className="fc-nav-sub__group-pages">{pages(true)}</div> : null}
        {open || previewing ? (
          <NavGroupPanel title={entry.name} preview={previewing} onPointerEnter={this.keepPreview} onPointerLeave={this.closePreview}>
            {pages(false)}
          </NavGroupPanel>
        ) : null}
      </div>
    );
  }

  /** A sub-menu inside the second column: its name as a heading, its pages under it (no third column). */
  private renderPanelGroup(entry: { name: string; pages: any[] }, activePage: string): ReactNode {
    return (
      <div key={`group:${entry.name}`} className="fc-nav-panel__group">
        <p className="fc-nav-panel__group-title">{entry.name}</p>
        {entry.pages.map((page) => this.renderPage(page, activePage))}
      </div>
    );
  }

  /**
   * The item's trailing slot, `admin.layout.sidebar.item:<path>` — a count, a status dot — filled only
   * by the plugin that registered the item, so no plugin can label another's menu entry. The component
   * receives `{ path, active, isMini }`; collapsed, it sits on the icon's corner. Renders nothing when
   * the slot is empty, so a component returning null hides it.
   */
  private renderTrailing(path: string, active: boolean, isMini: boolean): ReactNode {
    const owner = this.pluginSlug;
    if (!owner) return null;
    return (
      <span className={isMini ? 'fc-nav-item-trailing fc-nav-item-trailing--mini' : 'fc-nav-item-trailing'}>
        <Slot
          name={NavItemView.trailingSlot(path)}
          props={{ path: NavUtils.normalizePath(path), active, isMini }}
          include={({ pluginSlug }) => pluginSlug === owner}
        />
      </span>
    );
  }

  static trailingSlot(path: string): string {
    return `admin.layout.sidebar.item:${NavUtils.normalizePath(path)}`;
  }
}
