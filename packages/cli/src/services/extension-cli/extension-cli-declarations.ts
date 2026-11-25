import fs from 'fs';
import path from 'path';
import type { IExtensionCliCommand } from '@cli/services/extension-cli/interfaces/extension-cli-command.interface';
import type { IExtensionCliDeclaration } from '@cli/services/extension-cli/interfaces/extension-cli-declaration.interface';

/**
 * Finds and reads the commands extensions declare.
 *
 * An extension (plugin, theme, appearance, app) that wants to be worked on through `fromcode` puts a
 * `fromcode.cli.json` at its root: `{ "commands": [{ "path": [...], "description": "...", "run": [...] }] }`.
 * The CLI names none of them and knows nothing of what they do — it lists, validates and runs them, so
 * a new extension adds its commands without a change here.
 *
 * Reading is cheap on purpose (one small JSON per extension, only when present): it runs on every
 * `fromcode` invocation, and a command must not cost anything until it runs.
 */
export class ExtensionCliDeclarations {
  static readonly FILE = 'fromcode.cli.json';
  private static readonly WORD = /^[a-z][a-z0-9-]*$/;

  /** Every accepted declaration under the given roots (each root holds one folder per extension). */
  static find(roots: string[], warn: (message: string) => void): IExtensionCliDeclaration[] {
    const found: IExtensionCliDeclaration[] = [];
    for (const root of roots) {
      if (!fs.existsSync(root)) continue;
      for (const entry of fs.readdirSync(root)) {
        const folder = path.join(root, entry);
        if (!fs.statSync(folder).isDirectory()) continue;
        const file = path.join(folder, ExtensionCliDeclarations.FILE);
        if (!fs.existsSync(file)) continue;
        const declaration = ExtensionCliDeclarations.read(folder, file, warn);
        if (declaration) found.push(declaration);
      }
    }
    return found;
  }

  private static read(folder: string, file: string, warn: (message: string) => void): IExtensionCliDeclaration | null {
    let document: { commands?: unknown };
    try {
      document = JSON.parse(fs.readFileSync(file, 'utf8')) as { commands?: unknown };
    } catch (error) {
      warn(`${file}: not valid JSON (${(error as Error).message}); its commands are left out.`);
      return null;
    }
    if (!Array.isArray(document.commands)) {
      warn(`${file}: "commands" must be a list; its commands are left out.`);
      return null;
    }
    const commands: IExtensionCliCommand[] = [];
    for (const candidate of document.commands as unknown[]) {
      const problem = ExtensionCliDeclarations.problem(candidate, folder);
      if (problem) warn(`${file}: ${problem}`);
      else commands.push(candidate as IExtensionCliCommand);
    }
    return { folder, commands };
  }

  /** Why a declared command cannot be used, or null. A bad one is skipped, never half-registered. */
  private static problem(candidate: unknown, folder: string): string | null {
    const command = candidate as Partial<IExtensionCliCommand> | null;
    if (!command || typeof command !== 'object') return 'a command must be an object.';
    const { path: words, description, run, arguments: args, cwd } = command;
    if (!Array.isArray(words) || !words.length || !words.every((word) => typeof word === 'string' && ExtensionCliDeclarations.WORD.test(word))) {
      return 'a command\'s "path" is a list of lowercase words (letters, digits, "-").';
    }
    const name = words.join(' ');
    if (typeof description !== 'string' || !description.trim()) return `"${name}" has no description.`;
    if (!Array.isArray(run) || !run.length || !run.every((part) => typeof part === 'string' && part)) return `"${name}" has no "run" (the program and its arguments).`;
    if (args !== undefined && (!Array.isArray(args) || !args.every((arg) => typeof arg === 'string' && /^[<[][a-zA-Z0-9-]+(\.\.\.)?[>\]]$/.test(arg)))) {
      return `"${name}": "arguments" are names like "<app>" or "[name]".`;
    }
    if (cwd !== undefined) {
      const target = path.resolve(folder, String(cwd));
      if (target !== folder && !target.startsWith(`${folder}${path.sep}`)) return `"${name}": "cwd" must stay inside the extension.`;
    }
    return null;
  }
}
