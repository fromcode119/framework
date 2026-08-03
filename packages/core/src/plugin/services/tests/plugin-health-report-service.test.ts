import { describe, it, expect } from 'vitest';
import { PluginHealthReportService } from '@core/plugin/services/plugin-health-report-service';
import { PluginState } from '@core/plugin/services/enums/plugin-state.enum';
import { PluginRegistryHealth } from '@core/plugin/services/enums/plugin-registry-health.enum';
import { PluginHeldReason } from '@core/plugin/services/enums/plugin-held-reason.enum';

describe('PluginHealthReportService.buildReport', () => {
  it('buckets, computes cap deltas, and sets ok=false when anything is held/errored', () => {
    const report = PluginHealthReportService.buildReport([
      { slug: 'cms', state: PluginState.ACTIVE, healthStatus: PluginRegistryHealth.HEALTHY, manifestCapabilities: ['api'], approvedCapabilities: ['api'] },
      { slug: 'ecommerce', state: PluginState.INACTIVE, healthStatus: PluginRegistryHealth.WARNING, heldReason: PluginHeldReason.CAPABILITY_DRIFT, manifestCapabilities: ['api', 'scheduler'], approvedCapabilities: ['api'] },
      { slug: 'mlm', state: PluginState.ERROR, healthStatus: PluginRegistryHealth.ERROR, error: 'boom' },
      { slug: 'search', state: PluginState.INACTIVE, healthStatus: PluginRegistryHealth.HEALTHY },
    ]);
    expect(report.ok).toBe(false);
    expect(report.counts).toEqual({ total: 4, active: 1, held: 1, error: 1, inactive: 1 });
    expect(report.held[0].slug).toBe('ecommerce');
    expect(report.held[0].addedCapabilities).toEqual(['scheduler']);
    expect(report.error[0].slug).toBe('mlm');
  });

  it('ok=true when all active/healthy', () => {
    const report = PluginHealthReportService.buildReport([
      { slug: 'cms', state: PluginState.ACTIVE, healthStatus: PluginRegistryHealth.HEALTHY },
    ]);
    expect(report.ok).toBe(true);
    expect(report.counts.held).toBe(0);
  });
});
