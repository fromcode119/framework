import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { StackPlan } from '@cli/services/stack/stack-plan';
import { StackTemplateRestore } from '@cli/services/stack/stack-template-restore';

describe('StackPlan', () => {
  let framework: string;
  let request: { name: string; framework: string; plugins: string[]; themes?: string[]; version: string; port: number };

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

  it('reports the worktree\'s version, not the image\'s: its root manifest is mounted read-only', () => {
    const overlay = new StackPlan(request).overlay();

    // Without it a plugin that needs a newer core than the image's tag is held on a stack running that core.
    expect(overlay).toContain(`${path.join(framework, 'package.json')}:/srv/package.json:ro`);
  });

  it('mounts a theme worktree under its theme.json slug, where the topology says themes go', () => {
    fs.mkdirSync(path.join(framework, 'modules', 'core', 'dist'), { recursive: true });
    const theme = fs.mkdtempSync(path.join(os.tmpdir(), 'fc-theme-change-'));
    fs.writeFileSync(path.join(theme, 'theme.json'), JSON.stringify({ slug: 'shop' }));

    const overlay = new StackPlan({ ...request, themes: [theme] }).overlay();

    // Named for the change on disk, found by slug in the platform.
    expect(overlay).toContain(`${theme}:/srv/themes/shop`);
    fs.rmSync(theme, { recursive: true, force: true });
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

  /**
   * A stack built from a template answered 404 on its own hostname until the console address was
   * repointed, and the first attempt at repointing it failed on quoting: the statement's own
   * quotes closed the quoting around `sh -c`, so psql got a bare `http://...` and stopped at the
   * colon. Both are cheap to keep from coming back.
   */
  it('keeps the console URL quoted inside the statement, and pipes it rather than passing it', () => {
    const command = StackTemplateRestore.consoleUrlCommand('http://console.demo.localhost:8200');

    expect(command).toContain("value = 'http://console.demo.localhost:8200'");
    expect(command).toMatch(/^echo ".*" \| docker compose exec -T db /);
    // The URL must not sit where `sh -c`'s own quoting would end before it.
    expect(command.indexOf('http://console.demo.localhost:8200')).toBeLessThan(command.indexOf("sh -c '"));
  });

  /**
   * A worktree is named for the change, not the extension — `plugin-boxnow` holds
   * `logistics-boxnow`. Mounted under the directory name it lands where nothing reads, and the
   * plugin is absent with no error to explain it.
   */
  it('mounts a plugin under its manifest slug, not its directory name', () => {
    fs.mkdirSync(path.join(framework, 'modules', 'core', 'dist'), { recursive: true });
    const plugin = fs.mkdtempSync(path.join(os.tmpdir(), 'wt-named-for-the-change-'));
    fs.writeFileSync(path.join(plugin, 'manifest.json'), JSON.stringify({ slug: 'logistics-boxnow' }));

    const overlay = new StackPlan({ ...request, plugins: [plugin] }).overlay();

    expect(overlay).toContain(`${plugin}:/srv/plugins/logistics-boxnow`);
    expect(overlay).not.toContain(`/srv/plugins/${path.basename(plugin)}`);
    fs.rmSync(plugin, { recursive: true, force: true });
  });

  /**
   * The checksum certifies a packed extension, so a worktree fails it by construction and every
   * mounted plugin is refused with "Security Violation". The deploy file states `true` as a
   * literal, so the overlay is the only place that can answer it.
   */
  it('turns off the integrity check that a worktree can never pass', () => {
    fs.mkdirSync(path.join(framework, 'modules', 'core', 'dist'), { recursive: true });

    expect(new StackPlan(request).overlay()).toContain('ENFORCE_PLUGIN_INTEGRITY=false');
  });

  /** A plugin whose dependency is absent is installed and never registered, silently. */
  it('names a declared dependency that is not mounted, and stays quiet about one that is', () => {
    const make = (slug: string, dependencies?: Record<string, string>): string => {
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), `fc-${slug}-`));
      fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify({ slug, dependencies }));
      return dir;
    };
    const boxnow = make('logistics-boxnow', { logistics: '^0.1.5' });
    const logistics = make('logistics', { finance: '^0.1.3' });

    const missing = new StackPlan({ ...request, plugins: [boxnow, logistics] }).missingDependencies();

    expect(missing.get('logistics')).toEqual(['finance']);
    expect(missing.has('logistics-boxnow')).toBe(false);
    for (const dir of [boxnow, logistics]) fs.rmSync(dir, { recursive: true, force: true });
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

/**
 * Several sessions work on the framework and its plugins at the same time, so two `stack up` calls
 * landing in the same second is the normal case. Reading the recorded stacks cannot settle it —
 * the record is written after the port is chosen — so the claim has to be the filesystem's.
 */
