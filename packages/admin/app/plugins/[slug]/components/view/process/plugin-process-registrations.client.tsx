import type { ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/react-class-components';
import type { IPluginRuntimeRegistration } from '@/app/plugins/[slug]/interfaces/plugin-runtime-registration.interface';

/**
 * Everything the plugin's process registered with the api and has not withdrawn — routes, hooks,
 * schedules, middleware, MCP tools — as the PROCESS reports it, so what is shown is what it runs.
 */
export class PluginProcessRegistrations extends PureReactor {
  @prop declare registrations: IPluginRuntimeRegistration[];

  private static label(registration: IPluginRuntimeRegistration): string {
    if (registration.steps?.length) return PluginProcessRegistrations.declared(registration);
    if (registration.method && registration.path) return `${registration.method.toUpperCase()} ${registration.path}`;
    if (registration.middleware) return `${registration.middleware.id} (${registration.middleware.stage})`;
    if (registration.event) return registration.event;
    if (registration.name) return registration.schedule ? `${registration.name} — ${registration.schedule}` : registration.name;
    if (registration.tools) return registration.tools.map((tool) => tool.tool).filter(Boolean).join(', ');
    return registration.key ?? '';
  }

  /** A declaration as the call it is — `context.collections.register(forms-list)` — naming what it declares, not its whole payload. */
  private static declared(registration: IPluginRuntimeRegistration): string {
    const steps = registration.steps ?? [];
    const call = [registration.root ?? 'context', ...steps.map((step) => step.name)].join('.');
    const what = (steps[steps.length - 1]?.args ?? []).slice(0, 2).map(PluginProcessRegistrations.named).filter(Boolean);
    return `${call}(${what.join(', ')})`;
  }

  /** What an argument is called: itself when it is text, else its slug, key, name or label. */
  private static named(argument: unknown): string {
    if (typeof argument === 'string' || typeof argument === 'number') return String(argument);
    const record = (argument ?? {}) as Record<string, unknown>;
    return String(record.slug ?? record.key ?? record.name ?? record.label ?? '');
  }

  render(): ReactNode {
    const groups = new Map<string, string[]>();
    for (const registration of this.registrations) {
      const list = groups.get(registration.kind) ?? [];
      list.push(PluginProcessRegistrations.label(registration));
      groups.set(registration.kind, list);
    }
    if (groups.size === 0) return <p className="text-xs text-slate-500">This process has registered nothing with the api.</p>;
    return (
      <div className="space-y-2">
        {[...groups.entries()].map(([kind, labels]) => (
          <details key={kind} className="rounded-lg border border-slate-100 dark:border-slate-800 px-3 py-2">
            <summary className="cursor-pointer text-xs font-semibold text-slate-600 dark:text-slate-300">{kind} <span className="text-slate-400 font-normal">· {labels.length}</span></summary>
            <ul className="mt-2 space-y-1">
              {labels.map((label, index) => <li key={`${kind}-${index}`} className="font-mono text-[11px] text-slate-500 break-all">{label}</li>)}
            </ul>
          </details>
        ))}
      </div>
    );
  }
}
