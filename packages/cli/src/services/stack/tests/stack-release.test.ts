import fs from 'fs';
import os from 'os';
import path from 'path';
import { execFileSync } from 'child_process';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { StackCommand } from '@cli/services/stack/stack-command';
import { StackImageLedger } from '@cli/services/stack/stack-image-ledger';
import { StackImagePull } from '@cli/services/stack/stack-image-pull';
import { StackReleaseCatalog } from '@cli/services/stack/stack-release-catalog';
import { StackReleaseSource } from '@cli/services/stack/stack-release-source';

describe('StackReleaseCatalog', () => {
  const index = JSON.stringify({ manifests: [{ platform: { os: 'linux', architecture: 'amd64' } }, { platform: { os: 'unknown', architecture: 'unknown' } }] });
  const catalog = (published: string[]) =>
    new StackReleaseCatalog('/repo', async (file, args) => {
      if (file === 'git') return 'a\trefs/tags/v0.2.9\nb\trefs/tags/v0.2.10\nc\trefs/tags/v0.2.11\nd\trefs/tags/vnext\n';
      return published.includes(args[args.length - 1]) ? index : null;
    });

  it('passes over a release whose images are not all published yet', async () => {
    const published = ['reg/api:v0.2.11', 'reg/api:v0.2.10', 'reg/admin:v0.2.10'];
    expect(await catalog(published).latest(['reg/api', 'reg/admin'], [])).toBe('v0.2.10');
  });

  it('takes a release that is already here without asking the registry', async () => {
    expect(await catalog([]).latest(['reg/api'], ['v0.2.11'])).toBe('v0.2.11');
  });

  it('answers null when the tags cannot be read', async () => {
    expect(await new StackReleaseCatalog('/repo', async () => null).latest(['reg/api'], [])).toBeNull();
  });

  it('lists only real platforms', async () => {
    expect(await catalog(['reg/api:v0.2.11']).platforms('reg/api:v0.2.11')).toEqual(['linux/amd64']);
  });
});

describe('StackImagePull', () => {
  it('names a platform only when this machine has no build of its own', () => {
    expect(StackImagePull.platformFor(['linux/amd64'], 'arm64')).toBe('linux/amd64');
    expect(StackImagePull.platformFor(['linux/amd64'], 'x64')).toBeNull();
    expect(StackImagePull.platformFor(['linux/amd64', 'linux/arm64'], 'arm64')).toBeNull();
    expect(StackImagePull.platformFor([], 'arm64')).toBeNull();
  });
});

describe('StackImageLedger', () => {
  let root: string;
  beforeEach(() => { root = fs.mkdtempSync(path.join(os.tmpdir(), 'fc-ledger-')); });
  afterEach(() => { fs.rmSync(root, { recursive: true, force: true }); });

  it('removes only releases it pulled, older than the newest two, that no stack names', async () => {
    const removed: string[] = [];
    const ledger = new StackImageLedger(root, async (_file, args) => {
      if (args[1] === 'rm') removed.push(args[2]);
      return '';
    });
    for (const tag of ['v1.0.1', 'v1.0.2', 'v1.0.3', 'v1.0.4']) ledger.record(tag);

    expect(await ledger.retire(['reg/api'], new Set(['v1.0.2']))).toEqual(['v1.0.1']);
    expect(removed).toEqual(['reg/api:v1.0.1']);
    expect(ledger.tags()).toEqual(['v1.0.4', 'v1.0.3', 'v1.0.2']);
  });

  it('keeps a release docker refuses to remove, to try again later', async () => {
    const ledger = new StackImageLedger(root, async (_file, args) => (args[1] === 'rm' ? null : '[]'));
    for (const tag of ['v1.0.1', 'v1.0.2', 'v1.0.3']) ledger.record(tag);

    expect(await ledger.retire(['reg/api'], new Set())).toEqual([]);
    expect(ledger.tags()).toContain('v1.0.1');
  });
});

describe('StackReleaseSource', () => {
  let work: string;
  beforeEach(() => { work = fs.mkdtempSync(path.join(os.tmpdir(), 'fc-release-')); });
  afterEach(() => { fs.rmSync(work, { recursive: true, force: true }); });

  it('reads the topology out of the release tag, not the checkout', async () => {
    const repo = path.join(work, 'repo');
    const git = (...args: string[]) => execFileSync('git', ['-C', repo, '-c', 'user.email=t@example.com', '-c', 'user.name=t', ...args], { stdio: 'ignore' });
    fs.mkdirSync(path.join(repo, 'deploy'), { recursive: true });
    fs.writeFileSync(path.join(repo, 'deploy', 'compose.yml'), 'released');
    fs.writeFileSync(path.join(repo, 'package.json'), '{}');
    fs.writeFileSync(path.join(repo, 'other.txt'), 'not needed');
    git('init', '-q');
    git('add', '.');
    git('commit', '-qm', 'release');
    git('tag', 'v1.0.0');
    fs.writeFileSync(path.join(repo, 'deploy', 'compose.yml'), 'changed since');

    const directory = await new StackReleaseSource(repo, path.join(work, 'stacks'), StackCommand.output).directoryFor('v1.0.0');

    expect(fs.readFileSync(path.join(directory, 'deploy', 'compose.yml'), 'utf8')).toBe('released');
    expect(fs.readdirSync(directory).sort()).toEqual(['deploy', 'package.json']);
    expect(fs.readdirSync(path.dirname(directory))).toEqual(['v1.0.0']);
  });
});
