import { state, bound } from '@fromcode119/react-class-components';
import { PlatformAccess } from '@/lib/tenants/platform-access';
import { AdminComponent } from '@/components/view/admin-component.client';

/**
 * What the infrastructure screen knows, and the edits that only change a field.
 *
 * The base of this page's chain: the saves sit above it, then the cards, then the lifecycle and the
 * scope gate.
 *
 * Every value here is blank until it has been LOADED. A number typed into a blank field is the
 * operator setting one; a blank field is not zero, and the placeholder names the default that
 * applies while it stays blank.
 */
export abstract class InfrastructureSettingsPageState extends AdminComponent {
  @state isLoading = true;
  /**
   * `null` means NEVER LOADED. The load had no `catch`, so a failed settings GET left this at its
   * seeded `false` and the switch rendered "Maintenance Mode: off" — a positive claim about the
   * platform's state that nothing had read. Flipping it then wrote that guess back.
   */
  @state maintenance: boolean | null = null;
  @state loadError: string | null = null;
  /** Days of `_system_logs` history to keep. '' / '0' means keep forever — the description says so. */
  @state logRetentionDays = '';
  /**
   * Separate from the log window, and floored, because this journal is not debug output — it is the
   * security and operator record, and the platform's EU AI Act Art. 12 store.
   */
  @state auditRetentionDays = '';
  @state isSavingAuditRetention = false;
  @state ssrGenerationCap = '';
  /** T5b render hosts: '' = the declared defaults. */
  @state ssrRenderMemoryMb = '';
  @state ssrRenderTimeoutMs = '';
  /** T5 plugin isolation: '' = the declared default (isolated). */
  @state isolationDefault = '';
  @state isolationMemoryMb = '';
  @state isolationTimeoutMs = '';
  @state isSavingIsolation = false;
  @state isSavingRetention = false;
  @state isSavingSsrCap = false;

  /**
   * Every control on this screen writes a PLATFORM setting — maintenance mode, the render worlds the
   * storefront keeps resident, the plugin isolation limits. They apply to every site on the box, the
   * API refuses them for anyone but a platform admin, and a site administrator reading its own site's
   * settings has no business being shown them at all. Say so instead of loading a form that cannot save.
   */
  protected get canManagePlatform(): boolean {
    return PlatformAccess.canManagePlatform(this.auth.user);
  }

  @bound
  onRetentionChange(value: number | string): void {
    this.logRetentionDays = String(value);
  }

  @bound
  onAuditRetentionChange(value: number | string): void {
    this.auditRetentionDays = String(value);
  }

  @bound
  onSsrCapChange(value: number | string): void {
    this.ssrGenerationCap = String(value);
  }

  @bound onSsrRenderMemory(value: number | string): void { this.ssrRenderMemoryMb = String(value); }
  @bound onSsrRenderTimeout(value: number | string): void { this.ssrRenderTimeoutMs = String(value); }

  @bound onIsolationDefault(value: string): void { this.isolationDefault = value; }
  @bound onIsolationMemory(value: number | string): void { this.isolationMemoryMb = String(value); }
  @bound onIsolationTimeout(value: number | string): void { this.isolationTimeoutMs = String(value); }
}
