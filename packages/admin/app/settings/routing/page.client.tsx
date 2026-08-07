import { ThemeMode } from '@fromcode119/core/client';
import { NotificationType } from '@/components/enums/notification-type.enum';
import { state, bound } from '@fromcode119/reactor';
import { ContextBridge } from '@fromcode119/react';
import { AdminComponent } from '@/components/view/admin-component.client';
import { Card } from '@/components/ui/view/card.client';
import { Button } from '@/components/ui/view/button.client';
import { Select } from '@/components/ui/view/select.client';
import { FrameworkIcons } from '@fromcode119/react';
import { AdminApi } from '@/lib/api';
import { AdminConstants } from '@/lib/constants/admin.constants';
import { Loader } from '@/components/ui/view/loader.client';
import { LoadErrorPanel } from '@/components/ui/view/load-error-panel.client';
import { AdminSystemSettingsClient } from '@/lib/settings/admin-system-settings-client';
import { RoutingPageUtils } from '@/app/settings/routing/routing-page-utils';
import { CompactPageHeader } from '@/components/ui/view/compact-page-header.client';
import { AdminClass } from '@/lib/admin-class';

export class RoutingPage extends AdminComponent {
  private static readonly PLACEHOLDERS = [
    { label: ':slug', description: 'The sanitized post title (recommended)', example: 'hello-world' },
    { label: ':id', description: 'The unique numeric ID of the content', example: '123' },
    { label: ':year', description: 'The 4-digit year of publication', example: '2026' },
    { label: ':month', description: 'The 2-digit month of publication', example: '01' },
    { label: ':day', description: 'The 2-digit day of publication', example: '31' },
    { label: ':category', description: 'The primary category slug', example: 'news' },
    { label: ':author', description: 'The author username', example: 'admin' },
  ];
  private static readonly PRESETS = [
    { label: 'Plain', value: '/:slug' },
    { label: 'Day and name', value: '/:year/:month/:day/:slug' },
    { label: 'Month and name', value: '/:year/:month/:slug' },
    { label: 'Numeric', value: '/:id' },
    { label: 'Category and name', value: '/:category/:slug' },
  ];
  private static readonly EMPTY_COLLECTIONS = [];
  @state isSaving = false;
  @state isLoading = true;
  /**
   * `null` means NEVER LOADED, for both of these.
   *
   * They were seeded `'/:slug'` and `'auto'` — which are exactly the values
   * `packages/api/src/server/server-settings-service.ts` already DECLARES and seeds for
   * `permalink_structure` / `routing_home_target`. So the copies here were a second, invisible
   * default, and because `componentDidMount` had `try/finally` with no `catch`, a failed settings GET
   * rendered them as the operator's saved routing and "Apply Routing" wrote them back over whatever
   * was really stored.
   */
  @state structure: string | null = null;
  @state homeTarget: string | null = null;
  @state loadError: string | null = null;
  @state searchTerm = '';
  @state frontendMeta: any = null;
  @state autoResolvedSource: string | null = null;
  @state availableCollections: any[] = [];
  @state homeOptions: { label: string; value: string; group?: string; section?: string; sourceKind?: string }[] = [
    { value: 'auto', label: 'Auto detect', group: 'System' }
  ];

  private optionsRequestId = 0;
  private optionsTimeout: ReturnType<typeof setTimeout> | null = null;
  private optionsDeps: { frontendMeta: any; availableCollections: any; collections: any; searchTerm: string } | null = null;
  private autoRequestId = 0;
  private autoDeps: { availableCollections: any; collections: any; homeTarget: string | null } | null = null;

  /** Collections published by the plugin registry (replaces `SettingsRegistrationService.useRegistration`). */
  private get safeCollections(): any[] {
    const collections = this.runtime?.plugins?.collections;
    return Array.isArray(collections) ? collections : RoutingPage.EMPTY_COLLECTIONS;
  }

  private get registerSettings(): (settings: Record<string, any>) => void {
    const plugins = this.runtime?.plugins;
    if (plugins?.registerSettings) return plugins.registerSettings.bind(plugins);
    return ContextBridge.registerSettings.bind(ContextBridge);
  }

  async componentDidMount(): Promise<void> {
    this.syncAutoSource();
    await this.loadRouting();
  }

  @bound
  async retryLoad(): Promise<void> {
    this.isLoading = true;
    await this.loadRouting();
  }

  private async loadRouting(): Promise<void> {
    this.loadError = null;
    try {
      const [settingsResponse, frontendMeta, collectionStats] = await Promise.all([
        AdminSystemSettingsClient.getAll(),
        AdminApi.get(AdminConstants.ENDPOINTS.SYSTEM.FRONTEND).catch(() => null),
        AdminApi.get(AdminConstants.ENDPOINTS.SYSTEM.STATS.COLLECTIONS).catch(() => [])
      ]);

      // Read from the response ALONE — an absent key renders empty, it does not fall back to a literal.
      this.structure = String(settingsResponse?.permalink_structure ?? '');
      this.homeTarget = String(settingsResponse?.routing_home_target ?? '');
      this.frontendMeta = frontendMeta;
      this.availableCollections = Array.isArray(collectionStats) ? collectionStats : [];
    } catch (err: any) {
      this.structure = null;
      this.homeTarget = null;
      this.loadError = err?.message || 'The routing settings request failed.';
    } finally {
      this.isLoading = false;
    }
  }

  componentDidUpdate(): void {
    this.scheduleHomeOptions();
    this.syncAutoSource();
  }

  componentWillUnmount(): void {
    if (this.optionsTimeout) clearTimeout(this.optionsTimeout);
    this.optionsTimeout = null;
    this.optionsRequestId += 1;
    this.autoRequestId += 1;
  }

  /** Debounced rebuild of the homepage target options (replaces the `[deps]` effect + `setTimeout` cleanup). */
  private scheduleHomeOptions(): void {
    const deps = {
      frontendMeta: this.frontendMeta,
      availableCollections: this.availableCollections,
      collections: this.safeCollections,
      searchTerm: this.searchTerm
    };
    const prev = this.optionsDeps;
    if (
      prev &&
      prev.frontendMeta === deps.frontendMeta &&
      prev.availableCollections === deps.availableCollections &&
      prev.collections === deps.collections &&
      prev.searchTerm === deps.searchTerm
    ) return;
    this.optionsDeps = deps;

    if (this.optionsTimeout) clearTimeout(this.optionsTimeout);
    this.optionsTimeout = null;
    if (!this.frontendMeta) return;

    const requestId = ++this.optionsRequestId;
    this.optionsTimeout = setTimeout(() => { void this.buildHomeOptions(requestId); }, 250);
  }

  private async buildHomeOptions(requestId: number): Promise<void> {
    const query = this.searchTerm.trim().toLowerCase();
    const frontendMeta = this.frontendMeta;
    const options: { label: string; value: string; group?: string; section?: string; sourceKind?: string }[] = [{ value: 'auto', label: 'Auto detect', group: 'System', sourceKind: 'Auto' }];
    const optionSet = new Set(options.map((o) => o.value));
    const availableCollectionSet = new Set(
      (this.availableCollections || [])
        .flatMap((c: any) => [String(c?.shortSlug || ''), String(c?.slug || '')])
        .filter(Boolean)
    );

    const rawLayouts = frontendMeta?.activeTheme?.layouts;
    const themeLayoutEntries = Array.isArray(rawLayouts)
      ? rawLayouts.map((layout: any, idx: number) => {
        if (typeof layout === 'string') return { key: layout, label: layout };
        const key = String(layout?.slug || layout?.name || layout?.key || layout?.id || `layout-${idx + 1}`);
        const label = String(layout?.title || layout?.label || layout?.name || layout?.slug || key);
        return { key, label };
      })
      : Object.entries(rawLayouts || {}).map(([key, layout]: [string, any]) => {
        if (typeof layout === 'string') return { key, label: layout };
        const label = String(layout?.title || layout?.label || layout?.name || layout?.slug || key);
        return { key, label };
      });

    themeLayoutEntries.forEach(({ key, label }) => {
      const value = `layout:${key}`;
      if (optionSet.has(value)) return;
      if (query && !label.toLowerCase().includes(query)) return;
      optionSet.add(value);
      options.push({
        value,
        label,
        group: 'Theme Layouts',
        sourceKind: 'Layout'
      });
    });

    const collectionCandidates = (this.safeCollections || []).filter((c: any) => {
      if (!c || c.system) return false;
      if (availableCollectionSet.size > 0) {
        const shortSlug = String(c.shortSlug || c.slug || '');
        const fullSlug = String(c.slug || '');
        if (!availableCollectionSet.has(shortSlug) && !availableCollectionSet.has(fullSlug)) return false;
      } else {
        // If system collection stats are unavailable, avoid probing unknown collection routes.
        return false;
      }
      const fields = Array.isArray(c.fields) ? c.fields : [];
      return fields.some((f: any) => f.name === 'slug');
    });

    const docsResponses = await Promise.all(
      collectionCandidates.map(async (c: any) => {
        const collectionSlug = c.shortSlug || c.slug;
        const limit = query ? 150 : 50;
        try {
          const response = await AdminApi.get(`${AdminConstants.ENDPOINTS.COLLECTIONS.BASE}/${collectionSlug}?limit=${limit}&sort=title`);
          return { collection: c, collectionSlug, docs: response?.docs || [] };
        } catch {
          return { collection: c, collectionSlug, docs: [] };
        }
      })
    );

    docsResponses.forEach(({ collection, collectionSlug, docs }) => {
      docs.forEach((doc: any) => {
        if (!doc || doc.id === undefined || doc.id === null) return;
        const value = `collection:${collectionSlug}:${doc.id}`;
        if (optionSet.has(value)) return;

        const collectionLabel = collection.label || collection.name || collection.shortSlug || collectionSlug;
        const title = RoutingPageUtils.getRecordDisplayTitle(doc, collectionLabel);
        const permalink = doc.customPermalink || doc.slug || '';
        const permalinkLabel = permalink ? `/${String(permalink).replace(/^\/+/, '')}` : '/';
        const searchableText = `${title} ${permalinkLabel} ${collectionLabel}`.toLowerCase();
        if (query && !searchableText.includes(query)) return;

        const pluginSlug = collection.pluginSlug || 'System';
        const pluginLabel = pluginSlug.charAt(0).toUpperCase() + pluginSlug.slice(1);
        const groupLabel = `Collection Records · ${pluginLabel}`;
        const sourceTag = RoutingPageUtils.getCollectionSourceTag(pluginSlug, collectionLabel);

        optionSet.add(value);
        options.push({
          value,
          label: `${title} (${permalinkLabel})`,
          group: groupLabel,
          section: collectionLabel,
          sourceKind: sourceTag
        });
      });
    });

    const groupOrder = new Map<string, number>([
      ['System', 0],
      ['Theme Layouts', 1]
    ]);
    const sortedOptions = [...options].sort((a, b) => {
      const aGroup = a.group || 'Options';
      const bGroup = b.group || 'Options';
      const aSection = a.section || '';
      const bSection = b.section || '';
      const aRank = groupOrder.has(aGroup) ? groupOrder.get(aGroup)! : 2;
      const bRank = groupOrder.has(bGroup) ? groupOrder.get(bGroup)! : 2;
      if (aRank !== bRank) return aRank - bRank;
      if (aGroup !== bGroup) return aGroup.localeCompare(bGroup);
      if (aSection !== bSection) return aSection.localeCompare(bSection);
      return a.label.localeCompare(b.label);
    });

    if (requestId === this.optionsRequestId) {
      this.homeOptions = sortedOptions;
    }
  }

  /** Resolve what "auto" currently points at (replaces the `[deps]` effect + `cancelled` flag). */
  private syncAutoSource(): void {
    const deps = {
      availableCollections: this.availableCollections,
      collections: this.safeCollections,
      homeTarget: this.homeTarget
    };
    const prev = this.autoDeps;
    if (
      prev &&
      prev.availableCollections === deps.availableCollections &&
      prev.collections === deps.collections &&
      prev.homeTarget === deps.homeTarget
    ) return;
    this.autoDeps = deps;
    void this.detectAutoSource(++this.autoRequestId);
  }

  private async detectAutoSource(requestId: number): Promise<void> {
    if (this.homeTarget !== 'auto') {
      this.autoResolvedSource = null;
      return;
    }
    const availableCollectionSet = new Set(
      (this.availableCollections || [])
        .flatMap((c: any) => [String(c?.shortSlug || ''), String(c?.slug || '')])
        .filter(Boolean)
    );
    const candidateCollections = (this.safeCollections || [])
      .filter((c: any) => {
        if (!c || c.system) return false;
        if (availableCollectionSet.size > 0) {
          const shortSlug = String(c.shortSlug || c.slug || '');
          const fullSlug = String(c.slug || '');
          if (!availableCollectionSet.has(shortSlug) && !availableCollectionSet.has(fullSlug)) return false;
        } else {
          // Skip probing collections when admin stats endpoint is unavailable.
          return false;
        }
        return RoutingPageUtils.getFieldNames(c).has('slug');
      })
      .map((c: any) => ({
        collectionSlug: c.shortSlug || c.slug,
        collectionLabel: c.label || c.name || c.shortSlug || c.slug,
        priority: RoutingPageUtils.getAutoCollectionPriority(c)
      }))
      .sort((a: any, b: any) => a.priority - b.priority || a.collectionSlug.localeCompare(b.collectionSlug));

    const queries = [
      { label: '"/"', query: 'customPermalink=%2F' },
      { label: '"/"', query: 'path=%2F' },
      { label: '"home"', query: 'slug=home' },
    ];

    for (const { label, query } of queries) {
      for (const candidate of candidateCollections) {
        try {
          const result = await AdminApi.get(`${AdminConstants.ENDPOINTS.COLLECTIONS.BASE}/${encodeURIComponent(candidate.collectionSlug)}?${query}&limit=1`);
          const doc = Array.isArray(result) ? result[0] : result?.docs?.[0];
          if (doc) {
            const title = RoutingPageUtils.getRecordDisplayTitle(doc, candidate.collectionLabel);
            if (requestId === this.autoRequestId) {
              this.autoResolvedSource = `Matched ${label} -> ${title} (${candidate.collectionLabel})`;
            }
            return;
          }
        } catch {
          // Candidate collection unavailable or no access; continue.
        }
      }
    }
    if (requestId === this.autoRequestId) {
      this.autoResolvedSource = 'No content match for "/" or "home" (using theme fallback).';
    }
  }

  @bound
  setStructure(value: string): void {
    this.structure = value;
  }

  @bound
  setHomeTarget(value: string): void {
    this.homeTarget = value;
  }

  @bound
  setSearchTerm(value: string): void {
    this.searchTerm = value;
  }

  @bound
  appendPlaceholder(label: string): void {
    const structure = this.structure;
    if (structure === null || structure.includes(label)) return;
    this.structure = structure.endsWith('/') ? `${structure}${label}` : `${structure}/${label}`;
  }

  @bound
  async handleSave(): Promise<void> {
    const addNotification = this.runtime.notify.addNotification;
    const structure = this.structure;
    const homeTarget = this.homeTarget;
    // Fail closed: never PUT values that were not read back from the server. The Save controls are not
    // rendered in this state.
    if (structure === null || homeTarget === null) return;
    this.isSaving = true;
    try {
      await AdminSystemSettingsClient.update({
        permalink_structure: structure,
        routing_home_target: homeTarget,
      });

      this.registerSettings({
        permalink_structure: structure,
        routing_home_target: homeTarget
      });

      addNotification({
        title: 'Routing Updated',
        message: 'Routing configuration has been synced.',
        type: NotificationType.SUCCESS
      });
    } catch (err: any) {
      addNotification({
        title: 'Update Failed',
        message: err?.message || 'Failed to save routing settings.',
        type: NotificationType.ERROR
      });
    } finally {
      this.isSaving = false;
    }
  }

  private get resolvedSourceLabel(): string {
    const selectedHomeOption = this.homeOptions.find((opt) => opt.value === this.homeTarget);
    const autoFallbackLayout = RoutingPageUtils.detectAutoFallbackLayout(this.frontendMeta);
    return this.homeTarget === 'auto'
      ? `${this.autoResolvedSource || 'Auto mode: checking "/" and "home"...'}${autoFallbackLayout ? ` Theme fallback: ${autoFallbackLayout}.` : ''}`
      : selectedHomeOption
        ? `${selectedHomeOption.sourceKind || selectedHomeOption.group || 'Source'} · ${selectedHomeOption.label}`
        : `Custom target · ${this.homeTarget}`;
  }

  render() {
    if (this.isLoading) {
      return (
        <div className="flex-1 flex items-center justify-center min-h-[400px]">
          <Loader label="Loading routing settings..." />
        </div>
      );
    }

    const theme = this.theme;
    const structure = this.structure;
    const homeTarget = this.homeTarget;
    const resolvedSourceLabel = this.resolvedSourceLabel;

    if (structure === null || homeTarget === null) {
      return (
        <div className="flex flex-col h-full animate-in fade-in duration-500">
          <CompactPageHeader
            theme={theme}
            icon={<FrameworkIcons.Map size={18} strokeWidth={2} />}
            title="Routing"
            subtitle="Homepage target & permalink configuration"
          />
          <LoadErrorPanel
            title="Routing settings could not be loaded"
            message={this.loadError || 'The routing settings request failed.'}
            onRetry={this.retryLoad}
            isRetrying={this.isLoading}
          />
        </div>
      );
    }

    return (
      <div className="flex flex-col h-full animate-in fade-in duration-500">
        <CompactPageHeader
          theme={theme}
          icon={<FrameworkIcons.Map size={18} strokeWidth={2} />}
          title="Routing"
          subtitle="Homepage target & permalink configuration"
          actions={
            <Button
              icon={<FrameworkIcons.Save size={15} strokeWidth={2} />}
              onClick={this.handleSave}
              isLoading={this.isSaving}
              className="h-9 px-4 rounded-lg font-semibold text-xs text-white"
            >
              Apply Routing
            </Button>
          }
        />

        <div className="p-6 w-full space-y-8">
          <Card title="Homepage Target">
            <div className="space-y-5 py-2">
              <div>
                <label className={`block text-[11px] font-semibold uppercase tracking-wide mb-3 ${theme === ThemeMode.DARK ? 'text-slate-400' : 'text-slate-500'}`}>
                  Root Route (`/`)
                </label>
                <Select
                  value={homeTarget}
                  onChange={this.setHomeTarget}
                  options={this.homeOptions}
                  placeholder="Select homepage target"
                  theme={theme}
                  searchable
                  onSearchChange={this.setSearchTerm}
                />
                <p className="mt-3 text-[11px] text-slate-500 font-medium italic">
                  Targets are discovered from available theme layouts and public collections.
                </p>
                <div className={`mt-3 ${AdminClass.SURFACE} px-3 py-2 text-[11px] ${theme === ThemeMode.DARK ? 'border-slate-800 bg-slate-900/50 text-slate-300' : 'border-slate-200 bg-slate-50 text-slate-700'
                  }`}>
                  <span className="font-semibold uppercase tracking-wide text-[10px] opacity-70">Resolved Homepage Source</span>
                  <div className="mt-1 font-semibold">{resolvedSourceLabel}</div>
                </div>
              </div>
            </div>
          </Card>

          <Card title="Permalink Structure">
            <div className="space-y-8 py-4">
              <div>
                <label className={`block text-[11px] font-semibold uppercase tracking-wide mb-3 ${theme === ThemeMode.DARK ? 'text-slate-400' : 'text-slate-500'}`}>
                  Common Structures
                </label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {RoutingPage.PRESETS.map((preset) => (
                    <button
                      key={preset.value}
                      onClick={() => this.setStructure(preset.value)}
                      className={`flex items-center justify-between p-4 rounded-xl border text-left transition-all ${structure === preset.value
                          ? 'border-indigo-600 bg-indigo-600/5 ring-1 ring-indigo-600'
                          : theme === ThemeMode.DARK
                            ? 'border-slate-800 bg-slate-900/50 hover:border-slate-700'
                            : 'border-slate-200 bg-white hover:border-indigo-300'
                        }`}
                    >
                      <div className="flex flex-col gap-1">
                        <span className={`text-xs font-semibold uppercase tracking-wide ${structure === preset.value ? 'text-indigo-400' : 'text-slate-500'
                          }`}>
                          {preset.label}
                        </span>
                        <code className={`text-sm ${theme === ThemeMode.DARK ? 'text-slate-200' : 'text-slate-800'}`}>
                          {preset.value}
                        </code>
                      </div>
                      {structure === preset.value && <FrameworkIcons.Check size={20} className="text-indigo-600" />}
                    </button>
                  ))}
                </div>
              </div>

              <div className={`p-6 rounded-xl border-2 border-dashed ${theme === ThemeMode.DARK ? 'border-slate-800 bg-slate-950/40' : 'border-slate-100 bg-slate-50/50'
                }`}>
                <label className={`block text-[11px] font-semibold uppercase tracking-wide mb-4 ${theme === ThemeMode.DARK ? 'text-slate-400' : 'text-slate-500'}`}>
                  Custom Structure
                </label>
                <div className="flex gap-3">
                  <div className={`flex-1 flex items-center px-4 ${AdminClass.SURFACE} transition-all focus-within:ring-4 focus-within:ring-indigo-600/10 focus-within:border-indigo-600 ${theme === ThemeMode.DARK ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-sm'
                    }`}>
                    <span className="text-slate-400 font-mono text-sm border-r pr-3 mr-3 py-2.5">https://yourdomain.com</span>
                    <input
                      value={structure}
                      onChange={(e) => this.setStructure(e.target.value)}
                      className="flex-1 bg-transparent border-none outline-none text-sm font-medium py-2.5"
                      placeholder="/:year/:slug"
                    />
                  </div>
                  <Button onClick={this.handleSave} isLoading={this.isSaving} className="px-8 rounded-xl">
                    Apply
                  </Button>
                </div>
              </div>
            </div>
          </Card>

          <Card title="Available Placeholders">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 py-4">
              {RoutingPage.PLACEHOLDERS.map((tag) => (
                <button
                  key={tag.label}
                  onClick={() => this.appendPlaceholder(tag.label)}
                  className={`p-5 rounded-xl border text-left transition-all hover:scale-[1.02] group ${theme === ThemeMode.DARK
                      ? 'border-slate-800 bg-slate-900/40 hover:bg-slate-800/60'
                      : 'border-slate-100 bg-white hover:shadow-xl hover:shadow-indigo-600/5'
                    }`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <code className="text-indigo-500 font-semibold text-sm px-2 py-1 bg-indigo-500/10 rounded-lg">
                      {tag.label}
                    </code>
                    <FrameworkIcons.Plus size={14} className="text-slate-400 group-hover:text-indigo-500 transition-colors" />
                  </div>
                  <p className={`text-[12px] font-bold mb-1 ${theme === ThemeMode.DARK ? 'text-slate-200' : 'text-slate-900'}`}>
                    {tag.description}
                  </p>
                  <p className="text-[10px] text-slate-500 font-medium">
                    Example: <span className="italic">{tag.example}</span>
                  </p>
                </button>
              ))}
            </div>
          </Card>
        </div>
      </div>
    );
  }
}
