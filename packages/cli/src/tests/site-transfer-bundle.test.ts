import assert from 'node:assert/strict';
// vitest, not `node:test` — the runner collects this suite, and under `node:test` it was invisible
// to it ("No test suite found"). It had never run in CI under either runner.
import { test, afterEach } from 'vitest';
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

const originalExecute = SiteTransferBundleCommandService.prototype.execute;
afterEach(() => {
  SiteTransferBundleCommandService.prototype.execute = originalExecute;
});

test('site-transfer CLI command forwards parsed options to the command service', async () => {
  const program = new Command();
  let receivedOptions: Record<string, unknown> | null = null;

  SiteTransferBundleCommandService.prototype.execute = async function execute(options) {
    receivedOptions = options as Record<string, unknown>;
  };

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

