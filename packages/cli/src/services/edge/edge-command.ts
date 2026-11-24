import fs from 'fs';
import path from 'path';
import { Command } from 'commander';
import { EdgeConfig } from '@cli/services/edge/config/edge-config';
import { EdgeFactory } from '@cli/services/edge/edge-factory';
import { EdgeHandoverCheck } from '@cli/services/edge/edge-handover-check';
import { EdgeStatusServer } from '@cli/services/edge/edge-status-server';
import { EdgeIdentityStore } from '@cli/services/edge/platform/edge-identity-store';
import { PlatformEdge } from '@cli/services/edge/platform-edge';

/**
 * `fromcode system edge` — an edge in front of any servers.
 *
 * - `edge` with `--config <file>` (or `FROMCODE_EDGE_CONFIG`): runs it as the file says. With neither, it
 *   is the platform's own edge as configured by the environment, as it has always been.
 * - `edge check <file>`: says whether a configuration is valid, and every problem if not.
 * - `edge join --control <host:port> --token <token> --root <sha256:…> --state <dir>`: joins a Fromcode
 *   platform, as the console's Settings → Security → Edges → Add edge prints it.
 */
export class EdgeCommand {
  static register(system: Command): void {
    const edge = system
      .command('edge')
      .description('An edge: holds public ports and passes connections, still encrypted, to the servers behind it (container entrypoint)')
      .option('--config <file>', 'the edge configuration (YAML or JSON); also FROMCODE_EDGE_CONFIG')
      .action(async (options: { config?: string }) => {
        const file = options.config || process.env.FROMCODE_EDGE_CONFIG;
        await EdgeCommand.run(file ? path.resolve(file) : null);
      });

    edge.command('check <file>').description('Check an edge configuration and list every problem').action((file: string) => {
      try {
        const config = EdgeConfig.load(path.resolve(file));
        console.log(`Valid: ${config.listeners.length} listener(s), ${config.origins.length} server(s), rules from ${config.rules.source}.`);
        const handover = EdgeHandoverCheck.problem();
        if (handover) console.log(`Note: ${handover}`);
      } catch (error: any) {
        console.error(error?.message || error);
        process.exitCode = 1;
      }
    });

    edge.command('join')
      .description('Join this edge to a Fromcode platform (the command is printed by Settings → Security → Edges → Add edge)')
      .requiredOption('--control <host:port>', "the platform's control address")
      .requiredOption('--token <token>', 'the one-time token')
      .requiredOption('--root <sha256>', "the SHA-256 of the platform's root certificate")
      .requiredOption('--state <dir>', 'where this edge keeps its key and certificate')
      .action(async (options: { control: string; token: string; root: string; state: string }) => {
        try {
          const joined = await new EdgeIdentityStore(path.resolve(options.state), EdgeCommand.version()).join(options.control, options.token, options.root);
          console.log(`Joined as edge ${joined.edgeId}; certificate valid until ${joined.notAfter}. Keys are in ${path.resolve(options.state)}.`);
        } catch (error: any) {
          console.error(`Not joined: ${error?.message || error}`);
          process.exitCode = 1;
        }
      });
  }

  private static async run(file: string | null): Promise<void> {
    let edge: PlatformEdge;
    let status: EdgeStatusServer | null = null;
    let identity: EdgeIdentityStore | null = null;
    if (file) {
      const config = EdgeConfig.load(file);
      ({ edge, identity } = EdgeFactory.build(config, EdgeCommand.version()));
      identity?.start();
      if (config.status) { status = new EdgeStatusServer(edge, identity); await status.start(config.status.address, config.status.port); }
    } else {
      edge = PlatformEdge.fromEnvironment();
    }
    await edge.start();
    const handover = EdgeHandoverCheck.problem();
    if (handover) console.warn(`[edge] ${handover}`);
    for (const signal of ['SIGTERM', 'SIGINT'] as const) {
      process.once(signal, () => {
        console.log(`[edge] ${signal}: closing the ports; open connections have ${PlatformEdge.STOP_GRACE_MS / 1000} s`);
        identity?.stop();
        status?.stop();
        void edge.stop(PlatformEdge.STOP_GRACE_MS).then(() => process.exit(0));
      });
    }
  }

  /** `fromcode-edge/<version>` — what the platform shows for this edge. */
  private static version(): string {
    for (const candidate of [path.join(process.cwd(), 'package.json'), path.resolve(__dirname, '../../../../../package.json')]) {
      try { return `fromcode-edge/${JSON.parse(fs.readFileSync(candidate, 'utf8')).version}`; } catch { /* next */ }
    }
    return 'fromcode-edge';
  }
}
