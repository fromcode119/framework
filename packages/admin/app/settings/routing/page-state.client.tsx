import { state, bound } from '@fromcode119/react-class-components';
import { AdminComponent } from '@/components/view/admin-component.client';
import { RoutingPageUtils } from '@/app/settings/routing/routing-page-utils';
import { SettingsPageScope } from '@/lib/settings/settings-page-scope';

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
  protected static readonly PLACEHOLDERS = [
    { label: ':slug', description: 'The sanitized post title (recommended)', example: 'hello-world' },
    { label: ':id', description: 'The unique numeric ID of the content', example: '123' },
    { label: ':year', description: 'The 4-digit year of publication', example: '2026' },
    { label: ':month', description: 'The 2-digit month of publication', example: '01' },
    { label: ':day', description: 'The 2-digit day of publication', example: '31' },
    { label: ':category', description: 'The primary category slug', example: 'news' },
    { label: ':author', description: 'The author username', example: 'admin' },
  ];
  protected static readonly PRESETS = [
    { label: 'Plain', value: '/:slug' },
    { label: 'Day and name', value: '/:year/:month/:day/:slug' },
    { label: 'Month and name', value: '/:year/:month/:slug' },
    { label: 'Numeric', value: '/:id' },
    { label: 'Category and name', value: '/:category/:slug' },
  ];
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
    { value: 'auto', label: 'Auto detect', group: 'System' }
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
      ? `${this.autoResolvedSource || 'Auto mode: checking "/" and "home"...'}${autoFallbackLayout ? ` Theme fallback: ${autoFallbackLayout}.` : ''}`
      : selectedHomeOption
        ? `${selectedHomeOption.sourceKind || selectedHomeOption.group || 'Source'} · ${selectedHomeOption.label}`
        : `Custom target · ${this.homeTarget}`;
  }
}
