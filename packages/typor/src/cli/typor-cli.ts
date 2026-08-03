#!/usr/bin/env node
import { BuildCommand } from './build-command';
import { DestructureFoldCommand } from './destructure-fold-command';
import { EsbuildCommand } from './esbuild-command';
import { InterfaceSplitCommand } from './interface-split-command';
import { ModuleConstantFoldCommand } from './module-constant-fold-command';
import { ReactImportPruneCommand } from './react-import-prune-command';
import { TypeAliasToInterfaceCommand } from './type-alias-to-interface-command';
import { TypecheckCommand } from './typecheck-command';
import { TyporCommand } from './typor-command';

/**
 * The single `typor` entry point: `typor <command> [args…]`.
 *
 * One binary with subcommands, rather than a file per job invoked by path. A build step that silently
 * stops running is indistinguishable from a passing build, so an unknown or missing command is a HARD
 * failure (exit 2) that names what was asked for — never a quiet exit 0.
 */
export class TyporCli {
  /** command name -> the class that implements it. */
  static readonly COMMANDS: ReadonlyMap<string, new () => TyporCommand> = new Map<string, new () => TyporCommand>([
    ['build', BuildCommand],
    ['destructure-fold', DestructureFoldCommand],
    ['esbuild', EsbuildCommand],
    ['interface-split', InterfaceSplitCommand],
    ['module-constant-fold', ModuleConstantFoldCommand],
    ['react-import-prune', ReactImportPruneCommand],
    ['type-alias-to-interface', TypeAliasToInterfaceCommand],
    ['typecheck', TypecheckCommand],
  ]);

  static async main(argv: string[]): Promise<number> {
    const [name, ...rest] = argv;

    if (!name || name === '--help' || name === '-h') return TyporCli.usage(name ? 0 : 2);

    const command = TyporCli.COMMANDS.get(name);
    if (!command) {
      console.error(`[typor] unknown command "${name}".`);
      return TyporCli.usage(2);
    }
    return await new command().run(rest);
  }

  /** Print `typor --help` and return the given exit code, so callers can use it as a tail call. */
  private static usage(code: number): number {
    const width = Math.max(...[...TyporCli.COMMANDS.keys()].map((k) => k.length));
    const lines = [...TyporCli.COMMANDS].map(([name, C]) => `  ${name.padEnd(width)}  ${new C().summary}`);
    const out = code === 0 ? console.log : console.error;
    out(`Usage: typor <command> [args…]\n\nCommands:\n${lines.join('\n')}`);
    return code;
  }
}

TyporCli.main(process.argv.slice(2)).then((code) => process.exit(code));
