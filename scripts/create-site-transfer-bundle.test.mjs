import assert from 'node:assert/strict';
import test from 'node:test';
import { SiteTransferBundleScriptRunner } from './create-site-transfer-bundle.mjs';

test('site-transfer wrapper recognizes help without forwarding it', () => {
  const parsed = SiteTransferBundleScriptRunner.parseArgs(['--help']);

  assert.equal(parsed.help, true);
  assert.deepEqual(parsed.forwardedArgs, []);
});

test('site-transfer wrapper builds the delegated framework command from allowed arguments', () => {
  const parsed = SiteTransferBundleScriptRunner.parseArgs([
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
  assert.deepEqual(SiteTransferBundleScriptRunner.createCommand(parsed.forwardedArgs), [
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

test('site-transfer wrapper rejects unsupported arguments and missing values', () => {
  assert.throws(() => SiteTransferBundleScriptRunner.parseArgs(['--unknown']), /Unsupported argument/);
  assert.throws(() => SiteTransferBundleScriptRunner.parseArgs(['--label']), /Missing value for --label/);
});