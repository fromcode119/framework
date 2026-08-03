#!/usr/bin/env node
import { GenerateMiddlewareCommand } from './generate-middleware-command';
import { NextorCommand } from './nextor-command';
import { StampClientCommand } from './stamp-client-command';
import { VerifyMiddlewareCommand } from './verify-middleware-command';
import { VerifyViteConfigCommand } from './verify-vite-config-command';
import { ViteConfigCommand } from './vite-config-command';
import { WithMiddlewareCommand } from './with-middleware-command';

/**
 * The single `nextor` entry point: `nextor <command> [args…]`.
 *
 * One binary with subcommands, rather than a file per job invoked by path. A build step that silently
 * stops running is indistinguishable from a passing build, so an unknown or missing command is a HARD
 * failure (exit 2) that names what was asked for — never a quiet exit 0.
 */
export class NextorCli {
  /** command name -> the class that implements it. */
  static readonly COMMANDS: ReadonlyMap<string, new () => NextorCommand> = new Map<string, new () => NextorCommand>([
    ['generate-middleware', GenerateMiddlewareCommand],
    ['stamp-client', StampClientCommand],
    ['verify-middleware', VerifyMiddlewareCommand],
    ['verify-vite-config', VerifyViteConfigCommand],
    ['vite-config', ViteConfigCommand],
    ['with-middleware', WithMiddlewareCommand],
  ]);

  static async main(argv: string[]): Promise<number> {
    const [name, ...rest] = argv;

    if (!name || name === '--help' || name === '-h') return NextorCli.usage(name ? 0 : 2);

    const command = NextorCli.COMMANDS.get(name);
    if (!command) {
      console.error(`[nextor] unknown command "${name}".`);
      return NextorCli.usage(2);
    }
    return await new command().run(rest);
  }

  /** Print `nextor --help` and return the given exit code, so callers can use it as a tail call. */
  private static usage(code: number): number {
    const width = Math.max(...[...NextorCli.COMMANDS.keys()].map((k) => k.length));
    const lines = [...NextorCli.COMMANDS].map(([name, C]) => `  ${name.padEnd(width)}  ${new C().summary}`);
    const out = code === 0 ? console.log : console.error;
    out(`Usage: nextor <command> [args…]\n\nCommands:\n${lines.join('\n')}`);
    return code;
  }
}

NextorCli.main(process.argv.slice(2)).then((code) => process.exit(code));
