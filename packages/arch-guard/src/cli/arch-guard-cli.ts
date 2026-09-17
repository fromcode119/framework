#!/usr/bin/env node
import { ArchorCommand } from './arch-guard-command';
import { CiCommand } from './ci-command';
import { GuardRegistry } from './guard-registry';

/**
 * The single `arch-guard` entry point: `arch-guard <command> [args…]`.
 *
 * One binary with subcommands, rather than a file per check invoked by path. A guard that silently
 * stops running is indistinguishable from a passing build, so an unknown or missing command is a HARD
 * failure (exit 2) that names what was asked for — never a quiet exit 0.
 *
 * The command table lives in {@link GuardRegistry} because `arch-guard ci` walks it to run every
 * guard, and a registry owned by this class would mean the ci command importing the dispatcher that
 * imports the ci command. `ci` is added HERE for the same reason — it is the one command that must
 * not appear in the set it iterates.
 */
export class ArchorCli {
  /** command name -> the class that implements it. */
  static readonly COMMANDS: ReadonlyMap<string, new () => ArchorCommand> = new Map<string, new () => ArchorCommand>([
    ['ci', CiCommand],
    ...GuardRegistry.COMMANDS,
  ]);

  static main(argv: string[]): number {
    const [name, ...rest] = argv;

    if (!name || name === '--help' || name === '-h') return ArchorCli.usage(name ? 0 : 2);

    const command = ArchorCli.COMMANDS.get(name);
    if (!command) {
      console.error(`[arch-guard] unknown command "${name}".`);
      return ArchorCli.usage(2);
    }
    return new command().run(rest);
  }

  /** Print `arch-guard --help` and return the given exit code, so callers can use it as a tail call. */
  private static usage(code: number): number {
    const width = Math.max(...[...ArchorCli.COMMANDS.keys()].map((k) => k.length));
    const lines = [...ArchorCli.COMMANDS].map(([name, C]) => `  ${name.padEnd(width)}  ${new C().summary}`);
    const out = code === 0 ? console.log : console.error;
    out(`Usage: arch-guard <command> [args…]\n\nCommands:\n${lines.join('\n')}`);
    return code;
  }
}

process.exit(ArchorCli.main(process.argv.slice(2)));
