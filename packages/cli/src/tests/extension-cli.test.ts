import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { test } from 'vitest';
import { Command } from 'commander';
import { ExtensionCliRegistry } from '@cli/services/extension-cli/extension-cli-registry';

function root(files: Record<string, unknown>): string {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'ext-cli-'));
  for (const [folder, content] of Object.entries(files)) {
    fs.mkdirSync(path.join(base, folder), { recursive: true });
    fs.writeFileSync(path.join(base, folder, 'fromcode.cli.json'), typeof content === 'string' ? content : JSON.stringify(content));
  }
  return base;
}

const echo = (path: string[], extra: Record<string, unknown> = {}) => ({ path, description: 'says it', run: ['node', '-e', 'console.log(process.argv.slice(1).join("|"))', '--'], ...extra });

test('a declared command is added as nested groups with its arguments', () => {
  const program = new Command();
  ExtensionCliRegistry.register(program, [root({ shell: { commands: [echo(['app', 'sim', 'up'], { arguments: ['<app>', '<name>'] })] } })], ['node', 'fromcode'], () => {});
  const up = program.commands.find((c) => c.name() === 'app')?.commands.find((c) => c.name() === 'sim')?.commands.find((c) => c.name() === 'up');
  assert.ok(up);
  assert.match(up!.helpInformation(), /<app>/);
});

test('it runs the declared program with what was typed after the path, options untouched', () => {
  const program = new Command();
  const sink = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'ext-cli-out-')), 'args.txt');
  const typed = ['node', 'fromcode', 'app', 'sim', 'up', 'zen', 'a', '--package', 'x'];
  const writer = { path: ['app', 'sim', 'up'], description: 'writes its arguments', run: ['node', '-e', 'require("fs").writeFileSync(process.argv[1], process.argv.slice(2).join("|"))', sink] };
  ExtensionCliRegistry.register(program, [root({ shell: { commands: [writer] } })], typed, () => {});
  program.parse(typed);
  assert.equal(fs.readFileSync(sink, 'utf8'), 'zen|a|--package|x');
  assert.equal(process.exitCode ?? 0, 0);
});

test('bad declarations are skipped with a warning, the good ones still load', () => {
  const warnings: string[] = [];
  const program = new Command();
  ExtensionCliRegistry.register(program, [root({
    broken: '{ not json',
    mixed: { commands: [echo(['Bad Word']), { path: ['ok'], description: 'fine', run: [] }, echo(['good', 'one'])] },
    escape: { commands: [echo(['esc'], { cwd: '../..' })] },
  })], ['node', 'fromcode'], (m) => warnings.push(m));
  assert.ok(program.commands.find((c) => c.name() === 'good'));
  assert.equal(program.commands.find((c) => c.name() === 'esc'), undefined);
  assert.equal(warnings.length, 4);
});

test('a declared command never replaces a built-in one, and a path is declared once', () => {
  const warnings: string[] = [];
  const program = new Command();
  program.command('stack');
  ExtensionCliRegistry.register(program, [root({ a: { commands: [echo(['stack', 'x']), echo(['dup'])] }, b: { commands: [echo(['dup'])] } })], ['node', 'fromcode'], (m) => warnings.push(m));
  assert.equal(program.commands.filter((c) => c.name() === 'stack').length, 1);
  assert.equal(program.commands.filter((c) => c.name() === 'dup').length, 1);
  assert.equal(warnings.length, 2);
});
