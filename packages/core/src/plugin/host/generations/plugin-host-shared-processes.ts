import { ApiWorkers } from '@core/cluster/api-workers';
import { SpawnerClient } from '@core/process/spawner-client';
import { PluginHostGenerations } from '@core/plugin/host/generations/plugin-host-generations';
import type { PluginGuestGeneration } from '@core/plugin/host/generations/plugin-guest-generation';

/**
 * Several api processes (`API_WORKERS`) share ONE process per plugin. Process 0 starts them — at boot,
 * after a crash, on a move to a newer extension-host — and every other api process attaches to what it
 * started, the way an api attaches across a deploy (`takeOver`). A second process per plugin would not
 * fit in memory, would run the plugin's `onInit` twice, and would keep its own copy of every timer and
 * cache the plugin holds.
 *
 * An operator's update or new isolation limits start the new process wherever the request was handled,
 * as in a single api; the other api processes then restart one at a time (ApiWorkerSupervisor) and
 * attach to it.
 */
export abstract class PluginHostSharedProcesses extends PluginHostGenerations {
  /** Long enough for process 0 to start or replace a plugin's process; past it, this one starts it. */
  private static readonly SHARED_WAIT_MS = 90_000;
  private static readonly SHARED_POLL_MS = 500;

  /** True while an operator's update is starting the next process here (`reload`). */
  protected declare operatorRelaunch: boolean;
  /** True while new isolation limits make api 0 replace the process: the current one is not stuck. */
  protected declare awaitingReplacement: boolean;

  /** The plugin's process: this api's own when it starts them, otherwise the one process 0 started. */
  protected async acquire(excludePid: number | null = null): Promise<PluginGuestGeneration> {
    if (ApiWorkers.startsPluginProcesses()) return (await this.takeOver()) ?? this.launchGeneration();
    const shared = await this.waitForShared(excludePid);
    if (shared) return shared;
    // Api 0 runs every plugin process; one it is not running is one it decided not to run. A process of
    // our own would run the plugin's `onInit` again and keep a second copy of everything it holds.
    throw new Error(this.stopping
      ? `plugin "${this.slug}" changed in another api process; this one loads it when it restarts`
      : `api process 0 is not running plugin "${this.slug}" (waited ${PluginHostSharedProcesses.SHARED_WAIT_MS / 1000} s)`);
  }

  /**
   * Another api process changed this plugin (ProcessSignal.PLUGINS_CHANGED) and this one will restart to
   * load the change. Until then it serves through the process it holds, and never starts or attaches to
   * another: a disabled plugin must not be started again, nor an updated one in its old version.
   */
  holdUntilRestart(): void {
    this.stopping = true;
  }

  /** An update is asked of ONE api process: it starts the new code itself, wherever it runs. */
  async reload(manifest: Record<string, unknown>): Promise<void> {
    return this.flagged('operatorRelaunch', () => super.reload(manifest));
  }

  /**
   * Saved isolation limits reach EVERY api process (a settings save). Api 0 starts the process with the
   * new heap; the others attach to it, leaving the one it replaces to api 0 to retire.
   */
  async applySettings(settings: Parameters<PluginHostGenerations['applySettings']>[0]): Promise<void> {
    if (ApiWorkers.startsPluginProcesses()) return super.applySettings(settings);
    return this.flagged('awaitingReplacement', () => super.applySettings(settings));
  }

  /**
   * In an api process that does not start plugin processes, a crash, an overrun deadline or a newer
   * extension-host is met by ATTACHING to the process api 0 starts — never by starting another.
   */
  protected async relaunch(options: { drain: boolean } = { drain: true }): Promise<void> {
    if (ApiWorkers.startsPluginProcesses() || this.operatorRelaunch) return super.relaunch(options);
    const previous = this.generation && !this.generation.channel.isClosed ? this.generation : null;
    // Alive in the CURRENT extension-host means stuck past its deadline: stopped, so api 0 replaces it.
    // Alive in an older one means a deploy is moving it: api 0 starts it in the new host and retires this one.
    const stuck = previous && !this.awaitingReplacement && previous.guest.launcher === SpawnerClient.current(this.pool) ? previous : null;
    if (stuck) stuck.guest.kill('SIGKILL');
    const next = await this.waitForShared(stuck?.guest.pid ?? previous?.guest.pid ?? null);
    if (!next) {
      if (!this.stopping) this.logger.warn(`api process 0 has not replaced this plugin's process in ${PluginHostSharedProcesses.SHARED_WAIT_MS / 1000} s; it answers as unavailable here until it does`);
      return;
    }
    // The same switch a relaunch makes, with what the shared process registered in place of a fresh `onInit`.
    if (this.context) {
      this.registrations.resetForRestart(this.context);
      this.manager.middlewares.unregisterByPlugin(this.slug);
    }
    this.adopt(next);
    const restoring = (this.takenOver ?? []).splice(0);
    this.takenOver = null;
    if (this.context) for (const registration of restoring) await this.registrations.apply(this.context, registration);
    // Let go of the one it replaced; api 0 retires it once its own requests are done.
    if (previous && previous !== stuck) previous.channel.close();
    this.logger.info(`attached to process ${next.guest.pid}, which api process 0 started (${restoring.length} registrations)`);
  }

  private async flagged(flag: 'operatorRelaunch' | 'awaitingReplacement', work: () => Promise<void>): Promise<void> {
    this[flag] = true;
    try {
      await work();
    } finally {
      this[flag] = false;
    }
  }

  private async waitForShared(excludePid: number | null): Promise<PluginGuestGeneration | null> {
    const deadline = Date.now() + PluginHostSharedProcesses.SHARED_WAIT_MS;
    for (;;) {
      // Held (another api process changed the plugin): attach to nothing until this one restarts.
      if (this.stopping) return null;
      const attached = await this.takeOver({ excludePid, quiet: true });
      if (attached || Date.now() >= deadline) return attached;
      await new Promise((resolve) => setTimeout(resolve, PluginHostSharedProcesses.SHARED_POLL_MS));
    }
  }
}
