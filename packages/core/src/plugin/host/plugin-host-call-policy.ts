import type { IPluginRemoteCall } from '@core/plugin/host/interfaces/plugin-remote-call.interface';
import { PluginDeclarations } from '@core/plugin/host/declarations/plugin-declarations';
import { PluginInvocationKind } from '@core/plugin/host/enums/plugin-invocation-kind.enum';
import { PluginRemoteCallRoot } from '@core/plugin/host/enums/plugin-remote-call-root.enum';

/**
 * What ANY plugin process may ask the api for: the SDK's contract, and nothing past it.
 *
 * The api answers a guest by walking the steps it sends, so without this the walk reached whatever the
 * api process holds — every framework service behind `core`, and the language's own object machinery
 * behind any value. Isolation then contained nothing: a plugin under its own user could still act as
 * the api. The SDK is the boundary a plugin is built against, so it is the boundary enforced here:
 *
 *  - `context` — a surface the plugin's context actually has (`db`, `settings`, `plugins`, …), then
 *    only its public members. Capabilities still decide, inside each surface, what the plugin may do.
 *  - `core` — only the registry calls the SDK bridges (`PluginDeclarations.CORE_CALLS` and the mirror
 *    read), never the rest of the framework's services.
 *  - `ddl` — the owner connection, only while the plugin runs its own lifecycle (that is when its
 *    migrations run), never from a request, a hook or a job.
 *
 * A refusal names what was asked for, so a plugin that needs more gets it added to the SDK on purpose.
 */
export class PluginHostCallPolicy {
  /**
   * The members that reach the object model instead of the contract. `call`/`apply`/`bind` are NOT
   * here: `context.hooks.call` is part of the contract, and those names only reach the object model on
   * a FUNCTION value — which `assertTarget` never lets a step walk into.
   */
  private static readonly INTERNAL_MEMBERS = new Set<string>([
    'constructor', 'prototype', '__proto__', '__defineGetter__', '__defineSetter__', '__lookupGetter__', '__lookupSetter__',
    'caller', 'callee', 'arguments',
  ]);

  private static readonly CORE_READS: ReadonlyArray<readonly [string, string]> = [['defaultPageContracts', 'list']];

  /** Throws unless `call` stays inside the contract. `kind` is the invocation's, null for a declaration. */
  static assert(slug: string, call: Pick<IPluginRemoteCall, 'root' | 'steps'>, context: object, kind: string | null): void {
    const steps = Array.isArray(call.steps) ? call.steps : [];
    for (const step of steps) {
      const name = typeof step?.name === 'string' ? step.name : '';
      if (!name || name.startsWith('_') || PluginHostCallPolicy.INTERNAL_MEMBERS.has(name)) {
        PluginHostCallPolicy.refuse(slug, call.root, steps, `"${name || '?'}" is not part of the plugin contract`);
      }
    }
    if (call.root === String(PluginRemoteCallRoot.CONTEXT.value)) {
      if (!steps.length || !Object.prototype.hasOwnProperty.call(context, steps[0].name)) {
        PluginHostCallPolicy.refuse(slug, call.root, steps, 'the plugin context has no such surface');
      }
      return;
    }
    if (call.root === String(PluginRemoteCallRoot.CORE.value)) {
      const pair = [steps[0]?.name, steps[1]?.name];
      const listed = [...PluginDeclarations.CORE_CALLS, ...PluginHostCallPolicy.CORE_READS].some(([surface, method]) => surface === pair[0] && method === pair[1]);
      if (steps.length !== 2 || steps[0]?.args || !steps[1]?.args || !listed) {
        PluginHostCallPolicy.refuse(slug, call.root, steps, 'only the registries the SDK bridges are reachable');
      }
      return;
    }
    if (call.root === String(PluginRemoteCallRoot.DDL.value)) {
      if (kind !== String(PluginInvocationKind.LIFECYCLE.value) || steps.length !== 1) {
        PluginHostCallPolicy.refuse(slug, call.root, steps, 'the schema connection is only for the plugin\'s own migrations, during its lifecycle');
      }
      return;
    }
    PluginHostCallPolicy.refuse(slug, call.root, steps, 'unknown root');
  }

  /** A step may never read or call through a FUNCTION value: that is the object model, not an API. */
  static assertTarget(slug: string, root: string, steps: IPluginRemoteCall['steps'], target: unknown): void {
    if (typeof target === 'function') PluginHostCallPolicy.refuse(slug, root, steps, 'a function is called, never walked into');
  }

  private static refuse(slug: string, root: string, steps: IPluginRemoteCall['steps'], why: string): never {
    const path = [root, ...(steps ?? []).map((step) => String(step?.name ?? '?'))].join('.');
    throw Object.assign(new Error(`Security Violation: plugin "${slug}" cannot reach ${path} — ${why}.`), { code: 'plugin_contract_denied', target: path });
  }
}
