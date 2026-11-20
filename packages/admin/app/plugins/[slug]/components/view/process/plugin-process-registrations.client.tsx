import type { ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/react-class-components';
import type { ThemeMode } from '@fromcode119/core/client';
import { Hint } from '@/components/ui/view/hint.client';
import { SettingRow } from '@/components/ui/view/setting-row.client';
import type { IPluginRuntimeRegistration } from '@/app/plugins/[slug]/interfaces/plugin-runtime-registration.interface';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

/**
 * Everything the plugin's process registered with the api and has not withdrawn — routes, hooks,
 * schedules, middleware, MCP tools — as the PROCESS reports it, so what is shown is what it runs.
 */
export class PluginProcessRegistrations extends PureReactor {
  @prop declare registrations: IPluginRuntimeRegistration[];
  @prop declare theme: ThemeMode;

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
    if (groups.size === 0) return <div className="fc-settings-note"><Hint>{AdminI18n.t('plugins.detail.thisProcessHasRegisteredNothing')}</Hint></div>;
    // Every kind open, one row each: nothing here is folded away to be guessed at.
    return [...groups.entries()].map(([kind, labels]) => (
      <SettingRow key={kind} theme={this.theme} title={`${kind} · ${labels.length}`} stacked>
        <ul className="fc-code-list">
          {labels.map((label, index) => <li key={`${kind}-${index}`}>{label}</li>)}
        </ul>
      </SettingRow>
    ));
  }
}
