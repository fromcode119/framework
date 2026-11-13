import type { ReactElement, ReactNode, RefObject } from 'react';
import { AdminLink } from '@/components/view/admin-link.client';
import { PureReactor, prop, ref, Platform } from '@fromcode119/react-class-components';
import { Slot } from '@fromcode119/react';
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
  /** The page the current one belongs to, when a page is reached from a section's page (a record of a list). */
  @prop declare activePathOverride?: string;
  /** Raw pathname from `usePathname()`, supplied by the thin functional shim. */
  @prop declare rawPathname: string | null;

  @ref declare private sectionRef: RefObject<HTMLDivElement | null>;

  // An open section's pages can fall below the menu's fold (Settings sits at its foot); bring the whole
  // section into view, moving the menu only as far as needed.
  componentDidMount(): void {
    this.revealWhenOpen();
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

  private activePagePath(pages: any[]): string {
    const paths = pages.map((page) => NavUtils.normalizePath(page.path)).filter(Boolean) as string[];
    const override = NavUtils.normalizePath(this.activePathOverride);
    if (override && paths.includes(override)) return override;
    return NavUtils.resolveBestMatchPath(this.rawPathname || '', paths) || '';
  }

  render(): ReactElement {
    const { icon, label, href, onClick, isMini } = this;
    const pages = this.pages;
    const activePage = this.activePagePath(pages);
    const open = Boolean(this.active || activePage);
    const nav = 'fc-nav-item';
    const state = open ? ` ${nav}--active` : '';

    return (
      <div className="fc-nav-section" ref={this.sectionRef}>
        <AdminLink
          href={href}
          onClick={onClick}
          // Collapsed, the icon is the ONLY thing on screen, so the name lives in the tooltip and in the
          // accessible name instead.
          title={isMini ? label : undefined}
          aria-label={isMini ? label : undefined}
          aria-current={open && !activePage ? 'page' : undefined}
          className={`${nav}${isMini ? ` ${nav}--mini` : ''}${state}`}
        >
          <span className={`${nav}__icon`}>{icon}</span>
          {!isMini ? <span className={`${nav}__label`}>{label}</span> : null}
          {this.renderTrailing(href, open, !!isMini)}
        </AdminLink>

        {open && !isMini && pages.length > 0 ? (
          <div className="fc-nav-sub">
            {pages.map((page) => {
              const path = NavUtils.normalizePath(page.path);
              const current = path === activePage;
              return (
                <AdminLink
                  key={path}
                  href={page.path}
                  onClick={onClick}
                  aria-current={current ? 'page' : undefined}
                  className={`fc-nav-sub__item${current ? ' fc-nav-sub__item--active' : ''}`}
                >
                  <span className="fc-nav-sub__label">{page.sourcePlugin ? AdminNavText.panelLabel(page) : AdminNavText.menuLabel(page)}</span>
                  {this.renderTrailing(page.path, current, false)}
                </AdminLink>
              );
            })}
          </div>
        ) : null}
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
