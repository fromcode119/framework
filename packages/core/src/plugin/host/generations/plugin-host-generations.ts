import fs from 'fs';
import path from 'path';
import { ProjectPaths } from '@core/config/paths';
import { PluginChannel } from '@core/plugin/host/plugin-channel';
import { PluginHostAvailability } from '@core/plugin/host/availability/plugin-host-availability';
import { PluginGuestGeneration } from '@core/plugin/host/generations/plugin-guest-generation';
import { PluginGuestBootMessage } from '@core/plugin/host/generations/plugin-guest-boot-message';
import { PluginHostState } from '@core/plugin/host/plugin-host-state';
import { PluginHostProtocol } from '@core/plugin/host/protocol/plugin-host-protocol';
import { GuestProcessLaunchers } from '@core/process/guest-process-launchers';
import { GuestOutputStream } from '@core/process/enums/guest-output-stream.enum';
import { SpawnedGuestProcess } from '@core/process/spawned-guest-process';
import { SpawnerClient } from '@core/process/spawner-client';
import { SpawnerGuests } from '@core/process/spawner-guests';
import { PluginGuestAttachment } from '@core/plugin/host/connections/plugin-guest-attachment';
import { PluginGuestConnections } from '@core/plugin/host/connections/plugin-guest-connections';
import { PluginChannelMessage } from '@core/plugin/host/enums/plugin-channel-message.enum';

/**
 * Where a plugin's processes come from: started here (`launchGeneration`) — or, when another api
 * already runs one, taken over (`takeOver`).
 */
export abstract class PluginHostGenerations extends PluginHostAvailability {
  private static readonly ATTACH_TIMEOUT_MS = 10_000;

  /**
   * The guest's entry file — always core's BUILT output.
   *
   * A guest is a plain `node` process spawned as another user with an empty environment: it can run
   * neither TypeScript nor the host's loader. In production this file is in `dist/plugin/host/generations`
   * and the entry is one directory up. Under the api's `tsx watch` dev server core is loaded from
   * `src`, where only `plugin-guest-main.ts` exists — node exited (1) on every plugin before it could
   * connect — so fall back to the same file under `dist`. (Both are relative to THIS file's directory:
   * moving it here broke them once, and every plugin exited (1) again. `plugin-host-generations.test.ts`
   * now checks the path resolves.)
   */
  static guestMainPath(): string {
    const built = path.join(__dirname, '..', 'plugin-guest-main.js');
    if (fs.existsSync(built)) return built;
    return path.resolve(__dirname, '..', '..', '..', '..', 'dist', 'plugin', 'host', 'plugin-guest-main.js');
  }

  /**
   * Starts one more process of this plugin and boots it — BESIDE the current one when there is one:
   * its own guest id and sockets. It serves nothing until `adopt` makes it the current one.
   */
  protected async launchGeneration(): Promise<PluginGuestGeneration> {
    const launcher = GuestProcessLaunchers.current();
    this.generationCount += 1;
    const attachSecret = PluginGuestGeneration.secret();
    const guest = await launcher.launch({
      id: PluginGuestGeneration.guestId(this.slug, this.generationCount),
      entryPath: PluginHostGenerations.guestMainPath(),
      args: [],
      cwd: this.projectRoot,
      // A guest is mostly idle between calls, and V8's default young generation (16 MB semi-spaces,
      // three of them) is sized for a busy process. Twenty-two guests on production held ~2 GB in one
      // container; a 1 MB semi-space measured about 12 MB less resident per process at the same work.
      execArgv: [`--max-old-space-size=${this.limits.memoryMb}`, '--max-semi-space-size=1'],
      identity: this.identity,
      writableDirs: [ProjectPaths.getPluginDataDir(this.slug, this.projectRoot)],
      // What another api needs to find this process and take it over (`takeOver`).
      label: { slug: this.slug, version: String(this.manifest.version ?? ''), memoryMb: this.limits.memoryMb, attachSecret },
    });
    const generation = new PluginGuestGeneration(this.generationCount, guest, new PluginChannel(guest.port), attachSecret);
    this.wire(generation);
    const boot = PluginGuestBootMessage.build(generation, { slug: this.slug, pluginDir: this.pluginDir, entryPath: this.entryPath, manifest: this.manifest, projectRoot: this.projectRoot, defaultLocale: String(this.manager.i18n?.getDefaultLocale?.() ?? 'en') }, PluginHostGenerations.lingerMs());
    try {
      generation.described = await generation.channel.request(String(PluginChannelMessage.BOOT.value), boot, PluginHostState.BOOT_TIMEOUT_MS);
      const refusal = PluginHostProtocol.refusal(generation.described?.protocol);
      if (refusal) throw new Error(`plugin "${this.slug}" process refused: ${refusal}`);
    } catch (error) {
      await generation.retire();
      throw error;
    }
    const who = launcher.isolatesIdentity && this.identity ? `, uid ${this.identity.uid}` : '';
    this.logger.info(`isolated process ${guest.pid} up (heap ${this.limits.memoryMb} MB, deadline ${this.limits.timeoutMs} ms${who})`);
    return generation;
  }

  /**
   * A process of this plugin that is already running — started by the api a deploy is replacing — taken
   * over instead of starting a second one. Only in `extension-host` (nowhere else can a process outlive
   * its api), only for the same version and heap, and only through the process's own attach secret. What
   * it registered with the old api is restored when the boot's `onInit` would have run
   * (`restoreTakenOver`), not by running `onInit` again in a process that already ran it.
   *
   * Anything that goes wrong leaves it to a fresh process, and says so.
   */
  protected async takeOver(): Promise<PluginGuestGeneration | null> {
    const spawner = SpawnerClient.current();
    if (spawner?.hostedBy !== SpawnerClient.HOSTED_BY_EXTENSION_HOST) return null;
    const version = String(this.manifest.version ?? '');
    const listing = (await spawner.inventory())
      .filter((entry) => entry.label?.slug === this.slug && entry.label.version === version && entry.label.memoryMb === this.limits.memoryMb)
      .pop();
    if (!listing?.label) return null;
    try {
      const attachment = await PluginGuestAttachment.attach(path.join(listing.guestDir, PluginGuestConnections.CONTROL_SOCKET), listing.label.attachSecret, PluginHostGenerations.ATTACH_TIMEOUT_MS);
      // A process whose api went before it finished starting has registered only part of what it would:
      // taken over, the plugin would run without its routes. Left alone, it is stopped after the grace.
      if (!attachment.enabled) {
        attachment.channel.close();
        attachment.port.close();
        this.logger.warn(`running process ${listing.pid} had not finished starting (onEnable) when its api went; starting a new one`);
        return null;
      }
      await spawner.claim(listing.id).catch((error) => { attachment.channel.close(); throw error; });
      this.generationCount += 1;
      const guest = new SpawnedGuestProcess(spawner, listing.id, listing.pid, attachment.port, listing.guestDir);
      const generation = new PluginGuestGeneration(this.generationCount, guest, attachment.channel, listing.label.attachSecret, attachment.connectionId);
      generation.described = attachment.described;
      this.wire(generation);
      this.takenOver = attachment.registrations;
      this.logger.info(`took over running process ${listing.pid} (${attachment.registrations.length} registrations to restore) instead of starting another`);
      return generation;
    } catch (error) {
      this.logger.warn(`could not take over running process ${listing.pid}: ${error instanceof Error ? error.message : String(error)}; starting a new one`);
      return null;
    }
  }

  /** How long a process outlives the last api holding it: long enough for a deploy's next api, and only where one can come. */
  static lingerMs(): number {
    return SpawnerClient.current()?.hostedBy === SpawnerClient.HOSTED_BY_EXTENSION_HOST ? SpawnerGuests.ORPHAN_GRACE_MS : 0;
  }

  /** What every process of this plugin answers to: its messages, its output, and its exit. */
  private wire(generation: PluginGuestGeneration): void {
    const guest = generation.guest;
    guest.onOutput((stream, line) => (stream === GuestOutputStream.STDERR ? this.logger.warn(line) : this.logger.info(line)));
    generation.channel.serve((type, payload) => this.serve(type, payload, generation));
    generation.channel.onNotify((type, payload) => this.notified(type, payload));
    // Only the CURRENT guest's exit means anything; one we already replaced was retired on purpose.
    guest.onExit((code, signal) => { if (this.guest === guest) this.exited(code, signal); });
  }
}
