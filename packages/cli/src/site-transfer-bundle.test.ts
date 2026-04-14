import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';
import { Command } from 'commander';
import { SystemCommands } from './commands/system';
import { SiteTransferBundleCommandService } from './services/site-transfer-bundle-command-service';

type SiteTransferBundleScriptRunnerContract = {
  parseArgs(args: string[]): { forwardedArgs: string[]; help: boolean };
  createCommand(forwardedArgs: string[]): string[];
};

async function loadSiteTransferBundleScriptRunner(): Promise<SiteTransferBundleScriptRunnerContract> {
  const moduleUrl = pathToFileURL(path.resolve(__dirname, '../../../scripts/create-site-transfer-bundle.mjs')).href;
  const module = await import(moduleUrl) as { SiteTransferBundleScriptRunner: SiteTransferBundleScriptRunnerContract };
  return module.SiteTransferBundleScriptRunner;
}

test('site-transfer CLI command exposes expected help and flags', () => {
  const program = new Command();
  SystemCommands.registerSystemCommands(program);

  const systemCommand = program.commands.find((command) => command.name() === 'system');
  assert.ok(systemCommand);

  const bundleCommand = systemCommand?.commands.find((command) => command.name() === 'site-transfer-bundle');
  assert.ok(bundleCommand);

  const helpText = bundleCommand?.helpInformation() || '';
  assert.match(helpText, /--output <dir>/);
  assert.match(helpText, /--label <label>/);
  assert.match(helpText, /--include-public/);
  assert.match(helpText, /--include-uploads/);
  assert.match(helpText, /--include-secrets/);
  assert.match(helpText, /--skip-checksum/);
});

test('site-transfer CLI command forwards parsed options to the command service', async (context) => {
  const program = new Command();
  const originalExecute = SiteTransferBundleCommandService.prototype.execute;
  let receivedOptions: Record<string, unknown> | null = null;

  SiteTransferBundleCommandService.prototype.execute = async function execute(options) {
    receivedOptions = options as Record<string, unknown>;
  };

  context.after(() => {
    SiteTransferBundleCommandService.prototype.execute = originalExecute;
  });

  SystemCommands.registerSystemCommands(program);
  await program.parseAsync([
    'node',
    'fromcode',
    'system',
    'site-transfer-bundle',
    '--output',
    '/tmp/site-transfer',
    '--label',
    'demo-transfer',
    '--include-public',
    '--skip-checksum',
  ], { from: 'node' });

  assert.deepEqual(receivedOptions, {
    outputDir: '/tmp/site-transfer',
    label: 'demo-transfer',
    includeUploads: false,
    includePublic: true,
    includeSecrets: false,
    skipChecksum: true,
  });
});

test('site-transfer wrapper recognizes help without forwarding it', async () => {
  const runner = await loadSiteTransferBundleScriptRunner();
  const parsed = runner.parseArgs(['--help']);

  assert.equal(parsed.help, true);
  assert.deepEqual(parsed.forwardedArgs, []);
});

test('site-transfer wrapper builds the delegated framework command from allowed arguments', async () => {
  const runner = await loadSiteTransferBundleScriptRunner();
  const parsed = runner.parseArgs([
    '--output',
    '/tmp/site-transfer',
    '--label',
    'demo-transfer',
    '--include-public',
    '--skip-checksum',
  ]);

  assert.deepEqual(parsed.forwardedArgs, [
    '--output',
    '/tmp/site-transfer',
    '--label',
    'demo-transfer',
    '--include-public',
    '--skip-checksum',
  ]);
  assert.deepEqual(runner.createCommand(parsed.forwardedArgs), [
    'run',
    'fromcode',
    '--',
    'system',
    'site-transfer-bundle',
    '--output',
    '/tmp/site-transfer',
    '--label',
    'demo-transfer',
    '--include-public',
    '--skip-checksum',
  ]);
});

test('site-transfer wrapper rejects unsupported arguments and missing values', async () => {
  const runner = await loadSiteTransferBundleScriptRunner();

  assert.throws(() => runner.parseArgs(['--unknown']), /Unsupported argument/);
  assert.throws(() => runner.parseArgs(['--label']), /Missing value for --label/);
});