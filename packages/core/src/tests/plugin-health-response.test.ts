import { describe, expect, it, vi } from 'vitest';
import { PluginHealthResponseBuilder } from '@core/plugin-health-response-builder';
import { PluginHealthStatus } from '@core/enums/plugin-health-status.enum';

describe('PluginHealthResponseBuilder', () => {
  it('builds the standard plugin health payload', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-17T12:00:00.000Z'));

    expect(
      PluginHealthResponseBuilder.build({ slug: 'forms', version: '1.2.3' }),
    ).toEqual({
      status: PluginHealthStatus.OK,
      plugin: 'forms',
      version: '1.2.3',
      timestamp: '2026-04-17T12:00:00.000Z',
    });

    vi.useRealTimers();
  });

  it('accepts non-ok statuses and details', () => {
    expect(
      PluginHealthResponseBuilder.build(
        { slug: 'forms', version: '1.2.3' },
        { status: 'degraded', message: 'Slow database', details: { latencyMs: 1200 }, timestamp: '2026-04-17T12:00:00.000Z' },
      ),
    ).toEqual({
      status: PluginHealthStatus.DEGRADED,
      plugin: 'forms',
      version: '1.2.3',
      timestamp: '2026-04-17T12:00:00.000Z',
      message: 'Slow database',
      details: { latencyMs: 1200 },
    });
  });
});