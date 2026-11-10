import fs from 'fs';
import os from 'os';
import path from 'path';
import { describe, expect, it } from 'vitest';
import { ComposeContainerBody } from '@cli/services/updater/compose/compose-container-body';
import { ComposeFileMerge } from '@cli/services/updater/compose/compose-file-merge';
import { ComposeInterpolation } from '@cli/services/updater/compose/compose-interpolation';
import { ComposeProject } from '@cli/services/updater/compose/compose-project';
import { ComposeValueParser } from '@cli/services/updater/compose/compose-value-parser';
import { TarArchiveReader } from '@cli/services/updater/compose/tar-archive-reader';
import { DeployFolderFixture } from '@cli/services/updater/tests/deploy-folder-fixture';
import { TarFixture } from '@cli/services/updater/tests/tar-fixture';

const folderWith = (env: string) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'compose-project-'));
  for (const [file, content] of DeployFolderFixture.release()) {
    fs.mkdirSync(path.dirname(path.join(directory, file)), { recursive: true });
    fs.writeFileSync(path.join(directory, file), content);
  }
  fs.writeFileSync(path.join(directory, '.env'), env);
  return directory;
};

describe('the repository\'s own compose files, as the updater applies them', () => {
  // The guard that keeps a release from shipping a compose key the updater would refuse on every machine.
  it('builds a container for every service they declare, the pdf renderer\'s file included', () => {
    const project = ComposeProject.load(folderWith('VERSION=v0.2.600\nCOMPOSE_FILE=docker-compose.full-stack.yml:docker-compose.images.yml:docker-compose.pdf.yml\nPDF_RENDERER_TOKEN=t\n'), 'atlantis');
    const bodies = new ComposeContainerBody(project);

    expect(project.services()).toEqual(expect.arrayContaining(['api', 'extension-host', 'site-extension-host', 'admin', 'frontend', 'gateway', 'edge', 'updater', 'db', 'redis', 'pdf-renderer']));
    for (const service of project.services()) {
      const { body } = bodies.body(service, `atlantis-${service}-1`, 1, {}, '/opt/apps/atlantis');
      expect(body.Image, service).toBeTruthy();
      expect(body.Image, service).not.toContain('$');
    }
  });

  it('resolves images, networks, ports and the sandbox the way compose does', () => {
    const bodies = new ComposeContainerBody(ComposeProject.load(folderWith('VERSION=v0.2.600\n'), 'atlantis'));

    const edge = bodies.body('edge', 'atlantis-edge-1', 1, {}, '/opt/apps/atlantis').body;
    expect(edge.Image).toBe('ghcr.io/fromcode119/framework-gateway:v0.2.600');
    expect(edge.HostConfig.PortBindings).toEqual({ '80/tcp': [{ HostIp: '127.0.0.1', HostPort: '8085' }], '443/tcp': [{ HostIp: '127.0.0.1', HostPort: '8443' }] });
    expect(edge.HostConfig.Binds).toEqual(['/opt/apps/atlantis/edge:/app/deploy-edge:ro']);

    const api = bodies.body('api', 'atlantis-api-1', 1, {}, '/opt/apps/atlantis');
    expect(api.body.HostConfig.NetworkMode).toBe('atlantis_framework');
    expect(api.extraNetworks).toEqual([['atlantis-edge', { Aliases: ['api', 'atlantis-api-1'] }]]);
    expect(api.body.Env).toContain('GUEST_EGRESS_POLICY=deny');

    const sandbox = bodies.body('site-extension-host', 'atlantis-site-extension-host-1', 1, {}, '/opt/apps/atlantis').body;
    expect(sandbox.HostConfig.NetworkMode).toBe('none');
    expect(sandbox.HostConfig.Runtime).toBe('runc');
    expect(sandbox.HostConfig.Init).toBe(true);
    expect(sandbox.NetworkingConfig).toBeUndefined();

    const db = bodies.body('db-secrets', 'atlantis-db-secrets-1', 1, {}, '/opt/apps/atlantis').body;
    expect(db.Entrypoint).toEqual(['npm', 'run', 'fromcode', '--', 'db', 'init-bundled-superuser', '--file', '/run/fromcode-db/superuser.password']);
    expect(db.HostConfig.RestartPolicy).toEqual({ Name: '' });
  });

  it('takes a value set in .env over the compose default', () => {
    const bodies = new ComposeContainerBody(ComposeProject.load(folderWith('VERSION=v0.2.600\nLOG_LEVEL=debug\nGATEWAY_PORT=0.0.0.0:80\n'), 'atlantis'));

    expect(bodies.body('api', 'a', 1, {}, '/x').body.Env).toContain('LOG_LEVEL=debug');
    expect(bodies.body('edge', 'e', 1, {}, '/x').body.HostConfig.PortBindings['80/tcp']).toEqual([{ HostIp: '0.0.0.0', HostPort: '80' }]);
  });

  it('refuses a service key it does not apply, naming it', () => {
    const project = new ComposeProject('p', { services: { api: { image: 'x:1', healthcheck: { test: ['CMD', 'true'] } } } });

    expect(() => new ComposeContainerBody(project).body('api', 'p-api-1', 1, {}, '/x')).toThrow('"healthcheck"');
  });

  it('keeps compose\'s bookkeeping labels of the running container, with the new number', () => {
    const project = new ComposeProject('p', { services: { api: { image: 'x:1', labels: { team: 'web' } } } });
    const labels = { 'com.docker.compose.project': 'p', 'com.docker.compose.service': 'api', 'org.opencontainers.image.version': 'old' };

    expect(new ComposeContainerBody(project).body('api', 'p-api-3', 3, labels, '/x').body.Labels)
      .toEqual({ 'com.docker.compose.project': 'p', 'com.docker.compose.service': 'api', team: 'web', 'com.docker.compose.container-number': '3' });
  });
});

describe('ComposeInterpolation', () => {
  const env = new ComposeInterpolation({ VERSION: 'v1', EMPTY: '' });

  it('substitutes plain, defaulted and nested references, and $$ as a literal $', () => {
    expect(env.text('img:${VERSION}')).toBe('img:v1');
    expect(env.text('$VERSION/$$HOME')).toBe('v1/$HOME');
    expect(env.text('${EMPTY:-d}|${EMPTY-d}|${MISSING-d}')).toBe('d||d');
    expect(env.text('${EDGE_IMAGE:-ghcr.io/x:${VERSION:-latest}}')).toBe('ghcr.io/x:v1');
    expect(env.text('${VERSION:+set}${MISSING:+set}')).toBe('set');
  });

  it('refuses a required variable that is missing', () => {
    expect(() => env.text('${TOKEN:?Set TOKEN}')).toThrow('TOKEN must be set in .env: Set TOKEN');
  });
});

describe('ComposeFileMerge', () => {
  it('drops what !reset names, merges environment by name and volumes by target', () => {
    const base = ComposeFileMerge.parse('services:\n  api:\n    build: {context: .}\n    environment: [A=1, B=2]\n    volumes: [../data:/app/data, x:/y]\n', 'a.yml');
    const over = ComposeFileMerge.parse('services:\n  api:\n    build: !reset null\n    image: api:1\n    environment: {B: "3"}\n    volumes: [../other:/app/data]\n', 'b.yml');

    const api = ComposeFileMerge.merge(base, over).services.api;

    expect(api.build).toBeUndefined();
    expect(api.image).toBe('api:1');
    expect(api.environment).toEqual({ A: '1', B: '3' });
    expect(api.volumes).toEqual(['x:/y', '../other:/app/data']);
  });

  it('replaces a whole value marked !override', () => {
    const base = ComposeFileMerge.parse('services:\n  a:\n    cap_add: [KILL]\n', 'a.yml');
    const over = ComposeFileMerge.parse('services:\n  a:\n    cap_add: !override [CHOWN]\n', 'b.yml');

    expect(ComposeFileMerge.merge(base, over).services.a.cap_add).toEqual(['CHOWN']);
  });
});

describe('ComposeValueParser', () => {
  it('reads sizes, commands and port mappings as compose does', () => {
    expect(ComposeValueParser.bytes('512M')).toBe(512 * 1024 ** 2);
    expect(ComposeValueParser.bytes('2g')).toBe(2 * 1024 ** 3);
    expect(ComposeValueParser.words(`node -e "console.log('a b')" x\\ y`)).toEqual(['node', '-e', "console.log('a b')", 'x y']);
    expect(ComposeValueParser.port('[::1]:8443:443')).toEqual({ containerPort: '443/tcp', binding: { HostIp: '::1', HostPort: '8443' } });
    expect(ComposeValueParser.port('53:53/udp')).toEqual({ containerPort: '53/udp', binding: { HostIp: '', HostPort: '53' } });
    expect(ComposeValueParser.restart('on-failure:3')).toEqual({ Name: 'on-failure', MaximumRetryCount: 3 });
  });

  it('refuses a volume it cannot carry rather than dropping it', () => {
    expect(() => ComposeValueParser.volume('/only-a-target', '/x', () => null)).toThrow('anonymous volume');
    expect(() => ComposeValueParser.volume('undeclared:/data', '/x', () => null)).toThrow('not declared');
  });
});

describe('TarArchiveReader', () => {
  it('reads the files of an archived folder, long names included, and skips links', () => {
    const long = `edge/${'n'.repeat(120)}.cfg`;
    const archive = TarFixture.build('deploy', new Map([['a.yml', Buffer.from('one')], [long, Buffer.from('two')]]), [{ name: 'deploy/link', type: '2' }]);

    const files = TarArchiveReader.files(archive);

    expect([...files.keys()]).toEqual(['a.yml', long]);
    expect(files.get(long)!.toString()).toBe('two');
  });

  it('refuses a name that would leave the folder', () => {
    const archive = TarFixture.build('deploy', new Map(), [{ name: 'deploy/../../etc/passwd', type: '0', body: Buffer.from('x') }]);

    expect(() => TarArchiveReader.files(archive)).toThrow('outside its folder');
  });
});
