import type { ChangeEvent, ReactNode } from 'react';
import Link from 'next/link';
import { AdminConstants } from '@/lib/constants/admin.constants';
import { ThemeMode } from '@fromcode119/core/client';
import { PureReactor, bound, prop, state } from '@fromcode119/react-class-components';
import { Input } from '@/components/ui/view/input.client';
import { Select } from '@/components/ui/view/select.client';
import { Switch } from '@/components/ui/view/switch.client';
import { SiteInventory } from '@/lib/tenants/site-inventory';
import { SiteFormValues } from '@/app/sites/site-form-values';

/**
 * The fields that identify a site and say what it runs. Shared by New and Detail.
 *
 * Plugins and theme are offered ONLY when the inventory is given (creation); afterwards a site's
 * plugins and theme are managed on the ordinary Plugins/Themes pages with that site selected, and
 * this form shows identity and state only. Nothing here has a hidden default: an empty plugin set
 * and no theme are what a new site gets unless the operator picks otherwise, and the form says so.
 */
export class SiteForm extends PureReactor {
  @prop declare theme: ThemeMode;
  @prop declare values: SiteFormValues;
  @prop declare onChange: (values: SiteFormValues) => void;
  @prop declare inventory?: SiteInventory;
  @prop declare isNew: boolean;

  @state pluginSearch = '';

  private emit(patch: Partial<SiteFormValues>): void {
    this.onChange(this.values.with(patch));
  }

  @bound onSlug(e: ChangeEvent<HTMLInputElement>): void {
    const slug = e.target.value;
    // The id follows the slug until the operator edits the id by hand.
    this.emit(this.values.idFollowsSlug ? { slug, id: slug } : { slug });
  }

  @bound onId(e: ChangeEvent<HTMLInputElement>): void {
    this.emit({ id: e.target.value, idFollowsSlug: false });
  }

  @bound onPrimaryHost(e: ChangeEvent<HTMLInputElement>): void {
    this.emit({ primaryHost: e.target.value });
  }

  @bound onAliases(e: ChangeEvent<HTMLInputElement>): void {
    this.emit({ hostAliases: e.target.value });
  }

  @bound onAdminEmail(e: ChangeEvent<HTMLInputElement>): void {
    this.emit({ adminEmail: e.target.value });
  }

  @bound onTheme(value: string): void {
    this.emit({ theme: value });
  }

  @bound onKind(value: string): void {
    // A kind change resets what only the other kind has: a site has a theme, a workspace an appearance/preset.
    this.emit({ kind: value, theme: '', appearance: '', preset: '' });
  }

  @bound onAppearance(value: string): void {
    this.emit({ appearance: value, preset: '' });
  }

  @bound onPreset(value: string): void {
    const preset = this.inventory?.presets.find((entry) => entry.id === value);
    // Applying a preset FILLS the visible controls — it never acts invisibly.
    this.emit(preset ? { preset: value, plugins: [...preset.plugins], appearance: preset.appearance } : { preset: '' });
  }

  @bound onState(value: string): void {
    this.emit({ state: value });
  }

  @bound onVisibility(value: string): void {
    this.emit({ visibility: value });
  }

  private togglePlugin(slug: string, checked: boolean): void {
    const next = new Set(this.values.plugins);
    if (checked) next.add(slug); else next.delete(slug);
    this.emit({ plugins: [...next] });
  }

  /** What only a workspace has: the console it is locked to, and an optional declared preset. */
  /** Above this many rows a flat list stops being readable, so it gains a filter. */
  private static readonly SEARCH_THRESHOLD = 12;

  /** Why this plugin cannot be run by a site, in the operator's terms. */
  private static stateLabel(plugin: { state?: string; heldReason?: string }): string {
    if (plugin.heldReason) return `held — ${plugin.heldReason.replace(/_/g, ' ')}; re-approve`;
    if (plugin.state === 'error') return 'failed to start';
    return 'not enabled on this platform';
  }

  /**
   * Where an operator goes to make this plugin runnable.
   *
   * From `AdminConstants.ROUTES`, where every admin path is declared once. Note it is NOT the SDK's
   * path helper: importing that into a CLIENT component pulled `@fromcode119/sdk`'s index in with it,
   * and `@fromcode119/database` and `pg` behind that, failing the browser build on `Can't resolve 'tls'`.
   *
   * A row that states a problem and offers nothing is worse than no row: it is the same dead end as
   * hiding the plugin, with more words. Every unrunnable state has a page that resolves it.
   */
  private static stateHref(plugin: { slug: string; state?: string; heldReason?: string }): string {
    if (plugin.heldReason || plugin.state === 'error') return AdminConstants.ROUTES.PLUGINS.HEALTH;
    return AdminConstants.ROUTES.PLUGINS.DETAIL(plugin.slug);
  }

  /** The rows the filter leaves, matched on the name and the slug an operator would type. */
  private visiblePlugins(inventory: SiteInventory): SiteInventory['plugins'] {
    const term = this.pluginSearch.trim().toLowerCase();
    if (!term) return inventory.plugins;
    return inventory.plugins.filter((plugin) =>
      plugin.name.toLowerCase().includes(term) || plugin.slug.toLowerCase().includes(term));
  }

  @bound private onPluginSearch(e: ChangeEvent<HTMLInputElement>): void {
    this.pluginSearch = e.target.value;
  }

  private renderWorkspaceChoices(inventory: SiteInventory, values: SiteFormValues): ReactNode {
    return (
      <>
        <div className="fc-site-form__block">
          <span className="fc-site-form__label">Preset</span>
          <Select
            theme={this.theme}
            value={values.preset}
            onChange={this.onPreset}
            placeholder="No preset — choose the appearance and plugins yourself"
            clearable
            options={inventory.presets.map((preset) => ({ value: preset.id, label: preset.label }))}
          />
          {values.preset ? <span className="fc-site-form__hint">{inventory.presets.find((preset) => preset.id === values.preset)?.description}</span> : null}
        </div>
        <div className="fc-site-form__block">
          <span className="fc-site-form__label">Console appearance (locked for this workspace)</span>
          <Select
            theme={this.theme}
            value={values.appearance}
            onChange={this.onAppearance}
            options={[
              { value: '', label: 'Default console' },
              ...inventory.appearances.map((entry) => ({ value: entry.slug, label: `${entry.name} ${entry.version}`.trim() })),
            ]}
          />
        </div>
      </>
    );
  }

  render(): ReactNode {
    const values = this.values;
    const inventory = this.inventory;
    return (
      <div className="fc-site-form">
        <div className="fc-site-form__grid">
          <Select
            label="Kind"
            theme={this.theme}
            value={values.kind}
            onChange={this.onKind}
            disabled={!this.isNew}
            options={[
              { value: 'site', label: 'Storefront site — a theme on its domain, managed from this admin' },
              { value: 'workspace', label: 'Workspace — its domain is the console of a product; no storefront' },
            ]}
          />
          <Input label="Slug" value={values.slug} onChange={this.onSlug} placeholder="acme" />
          {this.isNew
            ? <Input label="Id" value={values.id} onChange={this.onId} placeholder="acme" />
            : null}
          <Input label="Primary host" value={values.primaryHost} onChange={this.onPrimaryHost} placeholder="acme.example.com" />
          <Input label="Host aliases" value={values.hostAliases} onChange={this.onAliases} placeholder="www.acme.example.com, shop.acme.example.com" />
          {this.isNew ? (
            <Input label="First administrator (email of an existing account)" value={values.adminEmail} onChange={this.onAdminEmail} placeholder="owner@acme.example.com" />
          ) : (
            <Select label="State" theme={this.theme} value={values.state} onChange={this.onState} options={[{ value: 'active', label: 'Active' }, { value: 'suspended', label: 'Suspended — the site answers 503' }]} />
          )}
          {/* A DIFFERENT question from State, and the one an operator asks far more often. Suspending
              a site takes its admin away too; this only decides who may READ it. */}
          <Select
            label="Visible to"
            theme={this.theme}
            value={values.visibility}
            onChange={this.onVisibility}
            options={[
              { value: 'private', label: 'Nobody yet — only this site\'s admins' },
              { value: 'unlisted', label: 'Anyone with the address — not indexed' },
              { value: 'public', label: 'Everyone — indexed' },
            ]}
          />
        </div>
        {this.isNew ? null : (
          /* The id is the row-level-security discriminator stamped into every row this site owns, so it
             cannot change without rewriting them all. Shown as the fact it is, rather than as a greyed
             out input that reads like something that ought to work. */
          <p className="fc-site-form__meta">Site id <code>{values.id}</code> — fixed for the life of the site. Rename with the slug and hosts above.</p>
        )}
        <p className="fc-site-form__hint">Hosts are bare hostnames — no scheme, path or port. The kind cannot change later.{values.isWorkspace ? ' An "api." alias of the domain is routed to the api for devices and apps.' : ''}</p>

        {inventory ? (
          <div className="fc-site-form__inventory">
            {values.isWorkspace ? this.renderWorkspaceChoices(inventory, values) : (
              <div className="fc-site-form__block">
                <span className="fc-site-form__label">Theme</span>
                <Select
                  theme={this.theme}
                  value={values.theme}
                  onChange={this.onTheme}
                  placeholder="No theme — the site renders bare until one is activated"
                  clearable
                  options={inventory.themes.map((theme) => ({ value: theme.slug, label: `${theme.name} ${theme.version}`.trim() }))}
                />
              </div>
            )}
            <div className="fc-site-form__block">
              <span className="fc-site-form__label">
                Plugins this site runs
                <span className="fc-site-form__count">{values.plugins.length} of {inventory.plugins.length}</span>
              </span>
              {inventory.plugins.length === 0 ? <span className="fc-sites__none">No plugins are installed on the platform.</span> : null}
              {inventory.plugins.length > SiteForm.SEARCH_THRESHOLD ? (
                <Input value={this.pluginSearch} onChange={this.onPluginSearch} placeholder="search plugins" />
              ) : null}
              <div className="fc-site-form__plugins">
                {this.visiblePlugins(inventory).map((plugin) => (
                  <div key={plugin.slug} className="fc-site-form__plugin">
                    <Switch
                      checked={values.plugins.includes(plugin.slug)}
                      onChange={(checked: boolean) => this.togglePlugin(plugin.slug, checked)}
                      disabled={plugin.runnable === false}
                      label={`${plugin.name} ${plugin.version}`.trim()}
                    />
                    {/* A plugin the platform cannot run says so HERE. Ticking it otherwise claims the
                        site runs something that is disabled — which is what "Toggle Failed" was. */}
                    {plugin.runnable === false ? (
                      <Link className="fc-site-form__plugin-state" href={SiteForm.stateHref(plugin)}>
                        {SiteForm.stateLabel(plugin)} →
                      </Link>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : null}
      </div>
    );
  }
}
