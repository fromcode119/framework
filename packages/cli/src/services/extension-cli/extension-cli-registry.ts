import { spawnSync } from 'child_process';
import path from 'path';
import { Command } from 'commander';
import chalk from 'chalk';
import { ExtensionCliDeclarations } from './extension-cli-declarations';
import type { IExtensionCliCommand } from './interfaces/extension-cli-command.interface';

/**
 * Adds the commands extensions declare to the program, as nested groups: `fromcode <group> <sub> … <command>`.
 *
 * A declared command can never replace one the CLI already has (its first word may not be a built-in
 * command), and two extensions cannot declare the same path — the second is skipped with a warning rather
 * than silently winning, because which one answers would otherwise depend on folder order.
 */
export class ExtensionCliRegistry {
  static register(program: Command, roots: string[], argv: string[], warn: (message: string) => void = (message) => console.error(chalk.yellow(message))): void {
    const builtIn = new Set(program.commands.map((command) => command.name()));
    const taken = new Set<string>();
    for (const declaration of ExtensionCliDeclarations.find(roots, warn)) {
      for (const command of declaration.commands) {
        const key = command.path.join(' ');
        if (builtIn.has(command.path[0])) { warn(`${declaration.folder}: "${key}" starts with a built-in command; skipped.`); continue; }
        if (taken.has(key)) { warn(`${declaration.folder}: "${key}" is already declared by another extension; skipped.`); continue; }
        taken.add(key);
        ExtensionCliRegistry.add(program, command, declaration.folder, argv);
      }
    }
  }

  /** The group for each leading word (made once), then the command itself under the last group. */
  private static add(program: Command, declared: IExtensionCliCommand, folder: string, argv: string[]): void {
    let parent = program;
    for (const word of declared.path.slice(0, -1)) {
      const existing = parent.commands.find((command) => command.name() === word);
      parent = existing ?? parent.command(word).description('Declared by extensions');
    }
    const leaf = parent.command(declared.path[declared.path.length - 1]).description(declared.description);
    for (const argument of declared.arguments ?? []) leaf.argument(argument);
    leaf.allowUnknownOption(true).allowExcessArguments(true).helpOption(false);
    leaf.action(() => {
      // What was typed after the command path, exactly as typed: options meant for the extension's own
      // program must reach it untouched, which commander's own parsing would not guarantee.
      const typed = argv.slice(2);
      const start = typed.findIndex((_, index) => declared.path.every((word, offset) => typed[index + offset] === word));
      const rest = typed.slice(start + declared.path.length);
      const [program0, ...fixed] = declared.run;
      const result = spawnSync(program0, [...fixed, ...rest], { cwd: path.resolve(folder, declared.cwd ?? '.'), stdio: 'inherit', env: process.env });
      if (result.error) console.error(chalk.red(`${declared.path.join(' ')}: could not start "${program0}": ${result.error.message}`));
      process.exitCode = result.status ?? 1;
    });
  }
}
