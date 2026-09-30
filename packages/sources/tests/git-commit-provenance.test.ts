import { execFileSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import { GitCommitProvenance } from '@sources/providers/git/git-commit-provenance';

/**
 * Sources builds a branch only when its commit is one GitHub merged — signed with GitHub's own key.
 *
 * The fixture is a real squash-merge from this (public) repository: framework `f563ec1c`,
 * "chore(release): 0.2.267 (#561)", signed by GitHub's current key B5690EEEBB952194.
 */
const MERGED_COMMIT = Buffer.from('dHJlZSBiZjZjNWUxNWJjMWU3N2M5MTZlNzI2MzlhMGUzZWQwNDkxZjNiYjZmCnBhcmVudCBhYTI2ZTc5MDExNTAxYzk3NGM0NTRmMWJkMTVmNzhjZWM2ZTNlNzExCmF1dGhvciBlczJ3cyA8ZXN0b3dzQGdtYWlsLmNvbT4gMTc5MDc4Njk2NCArMDIwMApjb21taXR0ZXIgR2l0SHViIDxub3JlcGx5QGdpdGh1Yi5jb20+IDE3OTA3ODY5NjQgKzAyMDAKZ3Bnc2lnIC0tLS0tQkVHSU4gUEdQIFNJR05BVFVSRS0tLS0tCiAKIHdzRmNCQUFCQ0FBUUJRSnF2VDJVQ1JDMWFRN3V1NVVobEFBQTc1WVFBQWhtM2xid2ZtVnFPL1RWVTVGdE9FQ0QKIGdkMEVnZXJUUTdmM2pVQkhML1ZFZWdBZjY2ZjFiSlBMSU9TK1hWS2FDcjc0RnRTbFJNd3JMRjJHa0RMQ2h6UnUKIDUvT3Z6T0FnOU01VVZVL1BIejF6ZnJrRlVQekVqZDdXUVRlbHNBcUJNWmcxajVQZzM5eTE5d05jL1hvblp5MnQKIDVBZUNtM2lZQUR6czdkNi9ZTE9aaGsxVmxxTkQrcDc4dkk5bGdrRVJwWDdCbWVsYU1HVzg2dlV0SndVZVZpamIKIE10RlB2eDB3dU9sOWdhSm5HYjVsT2s1NjlMcklEd294MFBibmcySnZXMm51SS9VYnBLenc2cndKblFyL0xtVFYKIFVqSy9kamFPODBTbER4ZUJUa1NBZGt1RzBmT1hWOUVGUjZPczJ0QjdNelVBYmUyRk8wUUw2eE1rS050aWNXTVgKIHpRK0xnemZUbmNVMjdrZithbi9qM1BpM2hDeVV5K0RZQkNHZlVwVU1VSEdNNkFGajUyb3R5SVB6cUk1R015WGMKIGhQSHAwclNqcERKZG5mNHEwWmpsbElzQTdnR2hpNHNLSFBCOThhSnpOVWtDQjNYY3dlZ04rdG1GT2IwcVNScDQKIHlwQVM5RGxSaXFyZHdDZEUvTmxhOGtzbk9jMlBCaHpNR3E5WEtTMkNWc0EydU1JYmd5U0djTmJBTkUxV3ZYM2MKIFgwZGxxdUJiWTRLaWlqOFVUVnB0Z2J4Z2poRXRHcWs4VklPSTExT24rc09WT0NyR29HcXg1d0dLeTZlV1l4REIKIDU1UThRenpXdEFyYllObzJHUVNuanFGQW94UWNNMk5uZWNSenI5LzlvYXUwR1NvNURCYkZyNDcweFd2SHE1RlYKICtxM2JCcDJrb3pSOHBsUjhMS1dtCiA9eWo2OQogLS0tLS1FTkQgUEdQIFNJR05BVFVSRS0tLS0tCiAKCmNob3JlKHJlbGVhc2UpOiAwLjIuMjY3ICgjNTYxKQ==', 'base64').toString('utf8');
const MERGED_SHA = 'f563ec1c49fda5b5a5e2454e950ba7b87a64ce36';
const GITHUB = 'https://github.com/fromcode119/framework.git';
const hasGpgv = (() => { try { execFileSync('gpgv', ['--version'], { stdio: 'ignore' }); return true; } catch { return false; } })();

describe('building only what GitHub merged', () => {
  const dirs: string[] = [];
  afterEach(() => { while (dirs.length) fs.rmSync(dirs.pop() as string, { recursive: true, force: true }); });

  function repoWith(raw: string): { dir: string; sha: string } {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fc-provenance-test-'));
    dirs.push(dir);
    execFileSync('git', ['init', '-q'], { cwd: dir });
    const sha = execFileSync('git', ['hash-object', '-t', 'commit', '-w', '--literally', '--stdin'], { cwd: dir, input: raw }).toString().trim();
    return { dir, sha };
  }

  it.skipIf(!hasGpgv)('builds a commit GitHub merged and signed', async () => {
    const { dir, sha } = repoWith(MERGED_COMMIT);
    expect(sha).toBe(MERGED_SHA);
    await expect(GitCommitProvenance.assertMergedByGitHub(dir, sha, GITHUB)).resolves.toBeUndefined();
  });

  it.skipIf(!hasGpgv)('refuses the same commit with its content changed — the signature no longer matches', async () => {
    const { dir, sha } = repoWith(MERGED_COMMIT.replace('chore(release): 0.2.267', 'chore(release): 0.2.999'));
    await expect(GitCommitProvenance.assertMergedByGitHub(dir, sha, GITHUB)).rejects.toThrow(/not signed by GitHub/);
  });

  it('refuses an unsigned commit — one somebody pushed rather than GitHub merged', async () => {
    const { payload } = GitCommitProvenance.split(MERGED_COMMIT);
    const { dir, sha } = repoWith(payload);
    await expect(GitCommitProvenance.assertMergedByGitHub(dir, sha, GITHUB)).rejects.toThrow(/is not signed/);
  });

  it('refuses a source that is not on GitHub, and says how to allow it', async () => {
    const { dir, sha } = repoWith(MERGED_COMMIT);
    await expect(GitCommitProvenance.assertMergedByGitHub(dir, sha, 'https://gitlab.example.com/x/y.git')).rejects.toThrow(/not on GitHub.*Build commits not merged through GitHub/);
  });

  it('splits a commit into the text GitHub signed and the signature', () => {
    const { payload, signature } = GitCommitProvenance.split(MERGED_COMMIT);
    expect(signature.startsWith('-----BEGIN PGP SIGNATURE-----')).toBe(true);
    expect(payload).not.toContain('gpgsig');
    expect(payload).toContain('chore(release): 0.2.267 (#561)');
  });
});
