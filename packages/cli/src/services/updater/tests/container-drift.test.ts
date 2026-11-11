import { describe, expect, it } from 'vitest';
import { ContainerDrift } from '@cli/services/updater/container-drift';
import type { IContainerInspect } from '@cli/services/updater/interfaces/container-inspect.interface';

const IMAGE = { Env: [], Cmd: null, Entrypoint: null, WorkingDir: '/app' };

function running(logConfig: Record<string, any>): IContainerInspect {
  return { Id: 'c1', Name: '/site-db-1', State: { Running: true }, Config: { Image: 'postgres:15-alpine', Env: [], Cmd: null, Entrypoint: null },
    HostConfig: { LogConfig: logConfig, RestartPolicy: { Name: 'unless-stopped' } }, NetworkSettings: { Networks: {} } };
}

describe('ContainerDrift', () => {
  it('sees the same log options in another key order as no change (Docker returns them sorted)', () => {
    const desired = { Image: 'postgres:15-alpine', HostConfig: { RestartPolicy: { Name: 'unless-stopped' }, LogConfig: { Type: 'journald', Config: { tag: '{{.Name}}', labels: 'com.docker.compose.service' } } } };
    const live = running({ Type: 'journald', Config: { labels: 'com.docker.compose.service', tag: '{{.Name}}' } });

    expect(ContainerDrift.differences(desired, live, IMAGE)).toEqual([]);
  });

  it('still sees a changed log option', () => {
    const desired = { Image: 'postgres:15-alpine', HostConfig: { RestartPolicy: { Name: 'unless-stopped' }, LogConfig: { Type: 'journald', Config: { tag: '{{.Name}}' } } } };
    const live = running({ Type: 'json-file', Config: { 'max-size': '10m' } });

    expect(ContainerDrift.differences(desired, live, IMAGE)).toEqual(['logging']);
  });
});
