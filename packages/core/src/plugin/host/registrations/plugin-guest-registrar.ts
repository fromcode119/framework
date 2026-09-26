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

  private readonly standing: IPluginGuestRegistration[] = [];

  constructor(private readonly channel: Pick<PluginChannel, 'request'>) {}

  send(registration: IPluginGuestRegistration): Promise<unknown> {
    this.record(registration);
    return this.channel.request('register', registration, PluginGuestRegistrar.TIMEOUT_MS);
  }

  /** What this process has registered and not withdrawn, oldest first — copies, never the live record. */
  snapshot(): IPluginGuestRegistration[] {
    return this.standing.map((registration) => ({ ...registration }));
  }

  private record(registration: IPluginGuestRegistration): void {
    if (registration.kind === PluginGuestRegistrationKind.TENANTS_FOR_EACH.value) return;
    if (registration.kind === PluginGuestRegistrationKind.HOOK_OFF.value) {
      const index = this.standing.findIndex((kept) => kept.kind === PluginGuestRegistrationKind.HOOK.value && kept.handlerId === registration.handlerId);
      if (index >= 0) this.standing.splice(index, 1);
      return;
    }
    this.standing.push({ ...registration });
  }
}
