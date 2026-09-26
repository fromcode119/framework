import type { PluginChannel } from '@core/plugin/host/plugin-channel';
import type { IPluginGuestRegistration } from '@core/plugin/host/interfaces/plugin-guest-registration.interface';
import { PluginGuestRegistrationKind } from '@core/plugin/host/enums/plugin-guest-registration-kind.enum';

/**
 * The ONE way a plugin process tells the api "forward this to me" — and the record of what stands.
 *
 * Every registration used to go straight onto the channel from four places, and once sent it existed
 * only in the api's memory: nothing in the plugin process could say what it had registered. That is
 * what an api that did NOT start this process needs to learn — the admin showing what a plugin runs,
 * and later a new api reattaching to a plugin process that outlived the old one. So each registration
 * is sent AND kept, in the order it was made:
 *
 * - `hook-off` removes the hook it names and is not kept itself — the record is what STANDS now;
 * - `tenants-for-each` is a run, not a registration (it answers how many sites it ran for), so it is
 *   sent and never kept.
 */
export class PluginGuestRegistrar {
  static readonly TIMEOUT_MS = 30_000;
  /** The api's answer to a registration it IGNORED: sent during a per-site replay of `onInit`. */
  static readonly SUPPRESSED = 'suppressed';

  private readonly standing: IPluginGuestRegistration[] = [];

  constructor(private readonly channel: Pick<PluginChannel, 'request'>) {}

  /**
   * Recorded when SENT, so the record keeps the order the plugin registered in, and dropped again if
   * the api answers that it ignored it. The api runs a plugin's `onInit` once more per site to do that
   * site's data work, with registration suppressed; without the answer every such pass was recorded,
   * and a plugin on five sites showed each of its hooks, middleware and tools six times.
   */
  async send(registration: IPluginGuestRegistration): Promise<unknown> {
    const kept = this.record(registration);
    const answer = await this.channel.request('register', registration, PluginGuestRegistrar.TIMEOUT_MS);
    const accepted = answer !== PluginGuestRegistrar.SUPPRESSED;
    if (!accepted && kept) this.standing.splice(this.standing.indexOf(kept), 1);
    // A withdrawal counts only once the api has withdrawn it; a suppressed one leaves the hook standing.
    if (accepted && registration.kind === PluginGuestRegistrationKind.HOOK_OFF.value) this.withdraw(registration);
    return answer;
  }

  /** What this process has registered and not withdrawn, oldest first — copies, never the live record. */
  snapshot(): IPluginGuestRegistration[] {
    return this.standing.map((registration) => ({ ...registration }));
  }

  private record(registration: IPluginGuestRegistration): IPluginGuestRegistration | null {
    if (registration.kind === PluginGuestRegistrationKind.TENANTS_FOR_EACH.value) return null;
    if (registration.kind === PluginGuestRegistrationKind.HOOK_OFF.value) return null;
    const kept = { ...registration };
    this.standing.push(kept);
    return kept;
  }

  private withdraw(hookOff: IPluginGuestRegistration): void {
    const index = this.standing.findIndex((kept) => kept.kind === PluginGuestRegistrationKind.HOOK.value && kept.handlerId === hookOff.handlerId);
    if (index >= 0) this.standing.splice(index, 1);
  }
}
