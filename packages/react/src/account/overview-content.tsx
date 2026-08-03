import { prop, state } from '@fromcode119/reactor';
import type { ReactNode, CSSProperties, MouseEvent as ReactMouseEvent } from 'react';
import { RouteConstants, AccountRouteUtils } from '@fromcode119/core/client';
import { SlotsContext } from '@react/context/slots-context';
import { PluginComponent } from '@react/view/plugin-component.client';
import { AccountAuthClient } from '@react/account/auth-client';
import type { ISlotComponent } from '@react/interfaces/slot-component.interface';
import type { AccountSection } from '@react/account/account-section';
import type { IAccountSectionNavigate } from '@react/account/interfaces/account-section-navigate.interface';
import type { IAccountOverviewContentProps } from '@react/account/interfaces/account-overview-content-props.interface';
import type { IAccountOverviewContentState } from '@react/account/interfaces/account-overview-content-state.interface';
import type { IAccountOverviewStat } from '@react/account/interfaces/account-overview-stat.interface';
import type { IAccountOverviewStatContext } from '@react/account/interfaces/account-overview-stat-context.interface';
import { AccountClass } from '@react/account/account-class';
import { AccountSectionIcons } from '@react/account/account-section-icons';

/**
 * Body of the framework account-overview section. Greets the signed-in person and renders the stat
 * cards contributed by installed plugins through the `account.overview.stats` slot (passed in as
 * `contributors` by {@link AccountOverviewPanel}). The framework names NO plugin here: each
 * contributor's `loadStats` is invoked defensively with a {@link AccountOverviewStatContext} — one
 * plugin failing or missing simply drops its cards. Cards are flat-sorted by their own `order` so a
 * plugin can interleave multiple cards among other plugins' cards deterministically.
 */
export class AccountOverviewContent extends PluginComponent {
  declare props: Pick<IAccountOverviewContentProps, keyof IAccountOverviewContentProps>;
  @prop declare contributors: ISlotComponent[];
  @prop declare sections: AccountSection[];
  @prop declare navigate?: IAccountSectionNavigate;

  /** The overview does not link to itself. */
  private static readonly OWN_SECTION = 'overview';

  /**
   * Where a plugin puts the ONE card that answers why most people opened the account.
   *
   * Baymard: 50% of visits to an account are to track an ongoing order, and order status + arrival date
   * is the single most important self-service feature — but "order" is a commerce concept, so the
   * framework cannot render it. A plugin registers a rich component here
   * (`registerSlotComponent('account.overview.primary', Card, '<slug>')`) and it renders directly under
   * the greeting, above the stats. The framework still names no plugin.
   */
  private static readonly PRIMARY_SLOT = 'account.overview.primary';

  @state loading: boolean = true;
  @state person: Record<string, any> | null = null;
  @state stats: IAccountOverviewStat[] = [];
  private mounted = false;
private get client(): any {
    return AccountAuthClient.of(this.api);
  }

  componentDidMount(): void {
    this.mounted = true;
    void this.loadAll();
  }

  componentDidUpdate(prevProps: this['props']): void {
    // Plugin frontend bundles register their contributors asynchronously after mount — reload when
    // the contributor set actually changes (changed-guard) so late registrations still surface cards.
    if ((prevProps.contributors || []).length !== (this.contributors || []).length) {
      void this.loadAll();
    }
  }

  componentWillUnmount(): void {
    this.mounted = false;
  }

  private async safe(fn: () => any): Promise<any> {
    try { const value = fn(); return value && typeof value.then === 'function' ? await value : value; } catch { return null; }
  }

  private statContext(): IAccountOverviewStatContext {
    return { namespace: (namespace: string) => this.namespace(namespace), api: this.api, t: this.t };
  }

  /** Contributor slot entries, deterministically ordered (priority, then plugin slug). */
  private contributorList(): ISlotComponent[] {
    return [...(this.contributors || [])].sort(
      (a, b) => (a.priority || 0) - (b.priority || 0) || String(a.pluginSlug || '').localeCompare(String(b.pluginSlug || '')),
    );
  }

  private async loadAll(attempt: number = 0): Promise<void> {
    const contributors = this.contributorList();
    const context = this.statContext();
    const [person, ...results] = await Promise.all([
      this.safe(() => this.client.get(RouteConstants.SEGMENTS.ME_PERSON, { silent: true })),
      ...contributors.map((entry) => this.safe(() => (entry.component as any)?.loadStats?.(context))),
    ]);
    if (!this.mounted) return;
    const personObj = person?.person ?? person?.data?.person ?? null;
    const stats = results
      .filter((result): result is IAccountOverviewStat[] => Array.isArray(result))
      .flat()
      .filter((stat) => stat && stat.key)
      .sort((a, b) => (a.order || 0) - (b.order || 0) || String(a.key).localeCompare(String(b.key)));
    // Plugin namespaces/auth can resolve a beat after mount, intermittently returning null and dropping
    // a card. Keep the RICHEST result across a couple of retries so the overview renders deterministically
    // instead of flickering between partial and full.
    const best = stats.length >= (this.stats?.length || 0) ? stats : this.stats;
    this.setState({ loading: false, person: personObj || (this.person || {}), stats: best });
    const hadNullSource = results.some((result) => result == null);
    if (attempt < 2 && hadNullSource) {
      window.setTimeout(() => { if (this.mounted) void this.loadAll(attempt + 1); }, 600);
    }
  }

  private renderStatCard(stat: IAccountOverviewStat): ReactNode {
    const href = stat.href || AccountRouteUtils.sectionPath(String(stat.sectionKey || ''));
    // The accent is the ONE thing a card carries as a value: it is the contributing plugin's colour, so
    // it cannot live in a stylesheet the framework owns. Everything else is a class.
    const accent = { [AccountClass.STAT_ACCENT_VAR]: stat.accent } as CSSProperties;
    return (
      <a
        key={stat.key}
        className={AccountClass.of('stat')}
        href={href}
        onClick={(event) => this.follow(event, String(stat.sectionKey || ''), href)}
        style={stat.accent ? accent : undefined}
      >
        <span className={AccountClass.of('stat-label')}>{stat.label}</span>
        <span className={AccountClass.of('stat-value')}>{stat.value}</span>
        {stat.sub ? <span className={AccountClass.of('stat-sub')}>{stat.sub}</span> : null}
      </a>
    );
  }

  /**
   * Switch section in-shell rather than reloading the document. A card that points somewhere OTHER than
   * an account section (a plugin may set an explicit `href`) is left to the browser.
   */
  private follow(event: ReactMouseEvent<HTMLAnchorElement>, sectionKey: string, href: string): void {
    if (!this.navigate || !sectionKey || href !== AccountRouteUtils.sectionPath(sectionKey)) return;
    this.navigate(event, sectionKey, href);
  }

  /**
   * Links to the other sections of the account — taken from the sections the shell actually resolved, so
   * this list grows and shrinks with the installed plugins instead of naming orders/courses/subscription
   * (which belong to ecommerce/lms/subscriptions, not to the framework). The overview itself is skipped.
   */
  private renderQuickLinks(): ReactNode {
    const links = (this.sections || []).filter((section) => section.key !== AccountOverviewContent.OWN_SECTION);
    if (links.length === 0) return null;
    return (
      <section className={AccountClass.of('card')}>
        <h3 className={AccountClass.of('card-title')}>{this.t('account.overview.manage', undefined, 'Manage your account')}</h3>
        <div className={AccountClass.of('quicklinks')}>
          {links.map((section) => this.renderTile(section))}
        </div>
      </section>
    );
  }

  /**
   * One dashboard tile: icon, label, chevron.
   *
   * The icon is what lets someone scan the grid instead of reading twelve labels in sequence, and the
   * chevron says the tile goes somewhere. The one-line description sits on `title` rather than on the
   * page: printed under every label it doubles the height of the dashboard and turns a grid you scan
   * into a page you read. The glyph is the section's own, so a plugin's section brings its own icon
   * without the framework knowing it.
   */
  private renderTile(section: AccountSection): ReactNode {
    const href = AccountRouteUtils.sectionPath(section.key);
    const description = section.descriptionKey ? this.t(section.descriptionKey, undefined, '') : '';
    const hint = description && description !== section.descriptionKey ? description : undefined;
    return (
      <a
        key={section.key}
        className={AccountClass.of('quicklink')}
        href={href}
        title={hint}
        onClick={(event) => this.follow(event, section.key, href)}
      >
        <span className={AccountClass.of('quicklink-icon')} aria-hidden="true">
          {AccountSectionIcons.for(section.key, section.icon)}
        </span>
        <span className={AccountClass.of('quicklink-label')}>{this.t(section.labelKey, undefined, section.key)}</span>
        <svg className={AccountClass.of('quicklink-go')} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="m9 18 6-6-6-6" />
        </svg>
      </a>
    );
  }

  /** The plugin-supplied primary card(s) — see {@link AccountOverviewContent.PRIMARY_SLOT}. */
  private renderPrimary(entries: ISlotComponent[]): ReactNode {
    if (!entries?.length) return null;
    return (
      <>
        {entries.map((entry, index) => {
          const Card = entry?.component as any;
          if (!Card) return null;
          return <Card key={`${entry.pluginSlug || 'p'}-${index}`} navigate={this.navigate} />;
        })}
      </>
    );
  }

  render(): ReactNode {
    const { loading, person, stats } = this;
    const name = String(person?.displayName || person?.firstName || '').trim();
    return (
      <div className={AccountClass.of('overview')}>
        {/* One line, not a card. A boxed "Welcome, <name>. Manage your profile and settings in one place."
            is the largest thing on the dashboard and tells the visitor nothing they came for; the
            greeting stays because it confirms WHOSE account this is, and nothing more. */}
        <p className={AccountClass.of('greeting')}>
          {name ? this.t('account.overview.greeting', { name }, `Welcome, ${name}`) : this.t('account.overview.greetingAnon', undefined, 'Welcome')}
        </p>

        {loading ? (
          <div className={`${AccountClass.of('card')} ${AccountClass.of('loading')}`}>{this.t('account.overview.loading', undefined, 'Loading your account…')}</div>
        ) : (
          <>
            <SlotsContext.Context.Consumer>
              {(slots) => this.renderPrimary(slots?.[AccountOverviewContent.PRIMARY_SLOT] || [])}
            </SlotsContext.Context.Consumer>
            {stats.length > 0 ? <div className={AccountClass.of('stats')}>{stats.map((stat) => this.renderStatCard(stat))}</div> : null}
            {this.renderQuickLinks()}
          </>
        )}
      </div>
    );
  }
}
