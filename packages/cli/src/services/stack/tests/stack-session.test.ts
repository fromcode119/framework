import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { StackSession } from '@cli/services/stack/stack-session';
import { StackPlan } from '@cli/services/stack/stack-plan';

/**
 * These cover the one answer that must never be wrong: whether the session that made a stack is
 * still using it. `stack prune` deletes databases on the strength of it.
 */
describe('StackSession', () => {
  const SESSION = '90be340e-800f-4bab-9261-ef62a894a2a1';
  let projects: string;

  beforeEach(() => {
    projects = fs.mkdtempSync(path.join(os.tmpdir(), 'fc-projects-'));
  });

  afterEach(() => {
    fs.rmSync(projects, { recursive: true, force: true });
  });

  /** The transcript lives under a project directory whose name nothing else knows. */
  const writeTranscript = (id: string, mtime: Date, project = 'some-encoded-project-path'): void => {
    const directory = path.join(projects, project);
    fs.mkdirSync(directory, { recursive: true });
    const file = path.join(directory, `${id}.jsonl`);
    fs.writeFileSync(file, '{}\n');
    fs.utimesSync(file, mtime, mtime);
  };

  it('finds the transcript without being told which project directory it is in', () => {
    writeTranscript(SESSION, new Date());

    const session = StackSession.fromWorkingDirectory(`/tmp/claude/${SESSION}/scratchpad/fw/deploy`, projects);

    expect(session.id).toBe(SESSION);
    expect(session.isStale).toBe(false);
  });

  it('reads the id from a UUID segment anywhere in the path, not a fixed position', () => {
    writeTranscript(SESSION, new Date());

    const deep = StackSession.fromWorkingDirectory(`/tmp/claude/${SESSION}/scratchpad/a/b/c/deploy`, projects);

    expect(deep.id).toBe(SESSION);
  });

  it('calls a session stale once it has been quiet longer than the threshold', () => {
    const quiet = new Date(Date.now() - (StackSession.STALE_HOURS + 1) * 3_600_000);
    writeTranscript(SESSION, quiet);

    expect(StackSession.fromWorkingDirectory(`/tmp/${SESSION}/x`, projects).isStale).toBe(true);
  });

  /**
   * The two "cannot tell" cases must both answer NO. Prune reads `isStale`, and deleting somebody's
   * database because a transcript could not be found is the one failure this must not have.
   */
  it('never calls a stack stale when ownership cannot be established', () => {
    expect(StackSession.fromWorkingDirectory('/tmp/no-uuid-here/deploy', projects).isStale).toBe(false);
    expect(StackSession.fromWorkingDirectory(`/tmp/${SESSION}/x`, projects).isStale).toBe(false);
  });
});

describe('StackPlan', () => {
  let framework: string;
  let request: { name: string; framework: string; plugins: string[]; version: string; port: number };

  /**
   * A checkout that declares its own layout, because the plan reads it rather than assuming it:
   * the workspace folder from `package.json`, the container paths from the topology's own mounts.
   */
  beforeEach(() => {
    framework = fs.mkdtempSync(path.join(os.tmpdir(), 'fc-framework-'));
    fs.writeFileSync(path.join(framework, 'package.json'), JSON.stringify({ workspaces: ['modules/*'] }));
    fs.mkdirSync(path.join(framework, 'deploy'), { recursive: true });
    fs.writeFileSync(
      path.join(framework, 'deploy', 'docker-compose.full-stack.yml'),
      ['services:', '  api:', '    volumes:', '      - ../plugins:/srv/plugins', '      - ../themes:/srv/themes', '      - ../data:/srv/data', ''].join('\n'),
    );
    request = { name: 'demo', framework, plugins: [], version: 'v1.2.3', port: 8200 };
  });

  afterEach(() => {
    fs.rmSync(framework, { recursive: true, force: true });
  });

  it('reads the workspace folder and container root from the checkout, never a built-in path', () => {
    fs.mkdirSync(path.join(framework, 'modules', 'core', 'dist'), { recursive: true });

    const overlay = new StackPlan(request).overlay();

    // `modules` and `/srv` come from this fixture; a hardcoded `packages` or `/app` would fail here.
    expect(overlay).toContain(`${path.join(framework, 'modules', 'core', 'dist')}:/srv/modules/core/dist`);
  });

  it('mounts a plugin where the topology says plugins go', () => {
    fs.mkdirSync(path.join(framework, 'modules', 'core', 'dist'), { recursive: true });
    const plugin = fs.mkdtempSync(path.join(os.tmpdir(), 'fc-plugin-'));

    const overlay = new StackPlan({ ...request, plugins: [plugin] }).overlay();

    expect(overlay).toContain(`${plugin}:/srv/plugins/${path.basename(plugin)}`);
    fs.rmSync(plugin, { recursive: true, force: true });
  });

  it('gives the edge its own TLS port, so a second stack does not die on 8443', () => {
    expect(StackPlan.tlsPortFor(8200)).toBe(8600);
    expect(new StackPlan(request).env()).toContain('GATEWAY_TLS_PUBLISH=127.0.0.1:8600');
  });

  it('keeps the stack off the shared proxy network and off a shared hostname', () => {
    const env = new StackPlan(request).env();

    expect(env).toContain('EXTERNAL_PROXY_NETWORK=demo-edge');
    expect(env).toContain('PROXY_NETWORK_EXTERNAL=false');
    expect(env).toContain('GATEWAY_PORT=127.0.0.1:8200');
  });

  /** Without json-file every container dies with "journald is not enabled on this host". */
  it('sets a log driver the Mac actually has', () => {
    expect(new StackPlan(request).env()).toContain('PLATFORM_LOG_DRIVER=json-file');
  });

  /**
   * Mounting a path the worktree has not built HIDES the image's own copy, which is how a
   * storefront ends up serving no runtime at all. A missing directory must simply not be mounted.
   */
  it('mounts nothing a worktree has not built', () => {
    const overlay = new StackPlan(request).overlay();

    expect(overlay).not.toContain('.next');
    expect(overlay).toContain('services:');
  });

  it('names every host the stack answers on', () => {
    const urls = new StackPlan(request).urls('shop');

    expect(urls).toEqual([
      'http://console.demo.localhost:8200',
      'http://portal.shop.demo.localhost:8200',
      'http://shop.demo.localhost:8200',
    ]);
  });
});
