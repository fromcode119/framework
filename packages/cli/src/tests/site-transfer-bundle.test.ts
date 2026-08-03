import assert from 'node:assert/strict';
import test from 'node:test';
import { Command } from 'commander';
import { SystemCommands } from '@cli/commands/system';
import { SiteTransferBundleCommandService } from '@cli/services/site-transfer-bundle-command-service';

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

