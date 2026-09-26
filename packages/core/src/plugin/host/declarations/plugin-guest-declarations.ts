import { PluginDeclarations } from '@core/plugin/host/declarations/plugin-declarations';
import { PluginRemoteCallRoot } from '@core/plugin/host/enums/plugin-remote-call-root.enum';
import { PluginGuestRemote } from '@core/plugin/host/plugin-guest-remote';
import { PluginGuestRegistrationKind } from '@core/plugin/host/enums/plugin-guest-registration-kind.enum';
import type { IPluginGuestRegistration } from '@core/plugin/host/interfaces/plugin-guest-registration.interface';

/**
 * The plugin process's side of `PluginDeclarations`: a declaration is sent as a registration, so the
 * process records it, instead of as a bare call nothing remembers. The api runs it the same way.
 */
export class PluginGuestDeclarations {
  constructor(
    private readonly send: (registration: IPluginGuestRegistration) => Promise<unknown>,
    /** Keeps a function argument (a provider's method) under a stable id, as every other call does. */
    private readonly keep: (handler: (...args: any[]) => unknown) => string,
  ) {}

  /** `base` (a remote context namespace) with its declaration methods sent as registrations. */
  namespace(name: string, base: object): any {
    if (!PluginDeclarations.CALLS.some(([namespace]) => namespace === name)) return base;
    const declarations = this;
    return new Proxy(base, {
      get(target, prop, receiver) {
        if (typeof prop === 'string' && PluginDeclarations.isDeclaration(name, prop)) return (...args: unknown[]) => declarations.declare(name, prop, args);
        return Reflect.get(target, prop, receiver);
      },
    });
  }

  /** `root` is where the call starts on the api: the plugin's context, or the platform's core services. */
  declare(namespace: string, method: string, args: unknown[], root: string = String(PluginRemoteCallRoot.CONTEXT.value)): Promise<unknown> {
    const dropped: string[] = [];
    const portable = PluginGuestRemote.portable(args, dropped, this.keep);
    if (dropped.length) console.warn(`[plugin] ${root}.${namespace}.${method}: dropped ${dropped.join(', ')} (not transferable)`);
    return this.send({ kind: String(PluginGuestRegistrationKind.DECLARATION.value), root, steps: [{ name: namespace }, { name: method, args: portable }] });
  }
}
