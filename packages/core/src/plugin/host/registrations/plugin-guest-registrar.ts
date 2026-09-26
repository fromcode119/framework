import type { PluginChannel } from '@core/plugin/host/plugin-channel';
import { PluginGuestRemote } from '@core/plugin/host/plugin-guest-remote';
import type { IPluginGuestRegistration } from '@core/plugin/host/interfaces/plugin-guest-registration.interface';
import { PluginGuestRegistrationKind } from '@core/plugin/host/enums/plugin-guest-registration-kind.enum';
import { PluginChannelMessage } from '@core/plugin/host/enums/plugin-channel-message.enum';

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
 *   sent and never kept;
 * - a declaration that repeats one that stands — differing at most in the functions it carries — is
 *   sent, and once the api accepts it, REPLACES that one where it stands: the api's registries key it
 *   the same way, so the newest is the one in force. A plugin re-declares its providers each time an
 *   api announces `plugins:ready`; kept as copies, every api that took the process over made the
 *   record longer and restored a stale copy first.
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
    const repeated = this.repeatedDeclaration(registration);
    const kept = repeated ? null : this.record(registration);
    // Sent to the api this invocation came from — the one that will apply it.
    const answer = await PluginGuestRemote.channelFor(this.channel as PluginChannel).request(String(PluginChannelMessage.REGISTER.value), registration, PluginGuestRegistrar.TIMEOUT_MS);
    const accepted = answer !== PluginGuestRegistrar.SUPPRESSED;
    if (!accepted && kept) this.standing.splice(this.standing.indexOf(kept), 1);
    if (accepted && repeated && this.standing.includes(repeated)) this.standing[this.standing.indexOf(repeated)] = { ...registration };
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

  /** The standing declaration this one repeats — equal but for the function handles it carries — or null. */
  private repeatedDeclaration(registration: IPluginGuestRegistration): IPluginGuestRegistration | null {
    if (registration.kind !== PluginGuestRegistrationKind.DECLARATION.value) return null;
    const shape = PluginGuestRegistrar.shape(registration.steps);
    return this.standing.find((kept) => kept.kind === registration.kind && kept.root === registration.root && PluginGuestRegistrar.shape(kept.steps) === shape) ?? null;
  }

  /** A function travels as a fresh handle each time it is passed; compared, every handle is the same. */
  private static shape(steps: IPluginGuestRegistration['steps']): string {
    return JSON.stringify(steps, (_key, value) => (value && typeof value === 'object' && PluginGuestRemote.CALLBACK in value ? PluginGuestRemote.CALLBACK : value));
  }

  private withdraw(hookOff: IPluginGuestRegistration): void {
    const index = this.standing.findIndex((kept) => kept.kind === PluginGuestRegistrationKind.HOOK.value && kept.handlerId === hookOff.handlerId);
    if (index >= 0) this.standing.splice(index, 1);
  }
}
