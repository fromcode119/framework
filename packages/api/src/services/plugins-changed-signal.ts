import { ProcessSignals, ProcessSignal } from '@fromcode119/core';
import { ApiWorkerSupervisor } from '@api/server/api-worker-supervisor';

/**
 * An operator's change to the platform's plugins, told to every OTHER api process (`API_WORKERS`).
 *
 * Each of them holds its own copy of which plugins exist, their state, their routes and their manifest.
 * The one that made the change has applied it; the others hold the plugin where it is — serving through
 * the process they have, never starting it again — and restart one at a time to load the change.
 *
 * Said BEFORE the work, so no other api process starts again the plugin a disable or a delete is about to
 * stop, and AFTER it, so they load what the work left. An unsupervised api process (one alone, or another
 * deploy's) hears it and does nothing.
 */
export class PluginsChangedSignal {
  static async around<T>(slug: string, work: () => Promise<T>): Promise<T> {
    PluginsChangedSignal.announce(slug);
    try {
      return await work();
    } finally {
      PluginsChangedSignal.announce(slug);
    }
  }

  static announce(slug: string): void {
    ProcessSignals.announce(ProcessSignal.PLUGINS_CHANGED, { slug });
  }

  /**
   * In every api process: hold what another one changed and ask the supervisor for a restart; mirror a
   * plugin api 0 stopped (ProcessSignal.PLUGIN_STOPPED) — no restart, which would only start it again.
   */
  static listen(manager: {
    pluginHosts?: { get(slug: string): { holdUntilRestart(): void } | null };
    markStoppedElsewhere(slug: string, message: string): void;
  }, log: (line: string) => void): void {
    ProcessSignals.on(ProcessSignal.PLUGIN_STOPPED, (payload: unknown, local: boolean) => {
      const stop = (payload ?? {}) as { slug?: unknown; message?: unknown };
      const slug = String(stop.slug ?? '').trim();
      if (local || !slug) return;
      manager.pluginHosts?.get(slug)?.holdUntilRestart();
      manager.markStoppedElsewhere(slug, String(stop.message ?? ''));
      log(`plugin "${slug}" was stopped by api process 0; stopped here too`);
    });
    ProcessSignals.on(ProcessSignal.PLUGINS_CHANGED, (payload: unknown, local: boolean) => {
      if (local) return;
      const slug = String((payload as { slug?: unknown } | null)?.slug ?? '').trim();
      if (!ApiWorkerSupervisor.requestRestart()) return;
      if (slug) manager.pluginHosts?.get(slug)?.holdUntilRestart();
      log(`plugins changed in another api process${slug ? ` ("${slug}")` : ''}; this one restarts in turn to load them`);
    });
  }
}
