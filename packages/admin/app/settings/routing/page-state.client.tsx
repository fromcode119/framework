import { state, bound } from '@fromcode119/react-class-components';
import { AdminComponent } from '@/components/view/admin-component.client';
import { RoutingPageUtils } from '@/app/settings/routing/routing-page-utils';
import { SettingsPageScope } from '@/lib/settings/settings-page-scope';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

/**
 * What the routing screen knows: the permalink structure being edited, what the home page points at,
 * and the collections it may point at.
 *
 * The base of this page's chain — resolution, then the load and save, then the lifecycle and markup.
 *
 * The placeholders and presets are declared here, once, because the field's help text, its insert
 * buttons and its validation all have to agree about which tokens exist.
 */
export abstract class RoutingPageState extends AdminComponent {
  protected static get PLACEHOLDERS() {
    return [
    { label: ':slug', description: AdminI18n.t('settings.routing.theSanitizedPostTitleRecommended'), example: 'hello-world' },
    { label: ':id', description: AdminI18n.t('settings.routing.theUniqueNumericIdOf'), example: '123' },
    { label: ':year', description: AdminI18n.t('settings.routing.the4DigitYearOf'), example: '2026' },
    { label: ':month', description: AdminI18n.t('settings.routing.the2DigitMonthOf'), example: '01' },
    { label: ':day', description: AdminI18n.t('settings.routing.the2DigitDayOf'), example: '31' },
    { label: ':category', description: AdminI18n.t('settings.routing.thePrimaryCategorySlug'), example: 'news' },
    { label: ':author', description: AdminI18n.t('settings.routing.theAuthorUsername'), example: 'admin' },
  ];
  }
  protected static get PRESETS() {
    return [
    { label: AdminI18n.t('settings.routing.plain'), value: '/:slug' },
    { label: AdminI18n.t('settings.routing.dayAndName'), value: '/:year/:month/:day/:slug' },
    { label: AdminI18n.t('settings.routing.monthAndName'), value: '/:year/:month/:slug' },
    { label: AdminI18n.t('settings.routing.numeric'), value: '/:id' },
    { label: AdminI18n.t('settings.routing.categoryAndName'), value: '/:category/:slug' },
  ];
  }
  protected static readonly EMPTY_COLLECTIONS = [];
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
  /**
   * Both keys this screen writes are per-site, so in the platform scope the API refuses the save and
   * the permalink structure and homepage target are lost together.
   */
  @state scope: SettingsPageScope | null = null;
  @state frontendMeta: any = null;
  @state autoResolvedSource: string | null = null;
  @state availableCollections: any[] = [];

  protected optionsRequestId = 0;
  protected optionsTimeout: ReturnType<typeof setTimeout> | null = null;
  protected optionsDeps: { frontendMeta: any; availableCollections: any; collections: any; searchTerm: string } | null = null;
  protected autoRequestId = 0;
  protected autoDeps: { availableCollections: any; collections: any; homeTarget: string | null } | null = null;

  /** Collections published by the plugin registry (replaces `SettingsRegistrationService.useRegistration`). */
  protected get safeCollections(): any[] {
    const collections = this.runtime?.plugins?.collections;
    return Array.isArray(collections) ? collections : RoutingPageState.EMPTY_COLLECTIONS;
  }
  @state homeOptions: { label: string; value: string; group?: string; section?: string; sourceKind?: string }[] = [
    { value: 'auto', label: AdminI18n.t('settings.routing.autoDetect'), group: AdminI18n.t('settings.routing.groupSystem') }
  ];

  protected get outOfScope(): boolean {
    return this.scope?.isEmpty === true;
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

  protected get resolvedSourceLabel(): string {
    const selectedHomeOption = this.homeOptions.find((opt) => opt.value === this.homeTarget);
    const autoFallbackLayout = RoutingPageUtils.detectAutoFallbackLayout(this.frontendMeta);
    return this.homeTarget === 'auto'
      ? `${this.autoResolvedSource || AdminI18n.t('settings.routing.autoModeCheckingAndHome')}${autoFallbackLayout ? ' ' + AdminI18n.t('settings.routing.themeFallback', { autoFallbackLayout: autoFallbackLayout }) : ''}`
      : selectedHomeOption
        ? `${selectedHomeOption.sourceKind || selectedHomeOption.group || AdminI18n.t('settings.routing.source')} · ${selectedHomeOption.label}`
        : AdminI18n.t('settings.routing.customTarget', { homeTarget: this.homeTarget });
  }
}
