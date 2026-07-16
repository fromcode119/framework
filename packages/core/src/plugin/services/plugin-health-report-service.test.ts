import { describe, it, expect } from 'vitest';
import { PluginHealthReportService } from './plugin-health-report-service';

describe('PluginHealthReportService.buildReport', () => {
  it('buckets, computes cap deltas, and sets ok=false when anything is held/errored', () => {
    const report = PluginHealthReportService.buildReport([
      { slug: 'cms', state: 'active', healthStatus: 'healthy', manifestCapabilities: ['api'], approvedCapabilities: ['api'] },
      { slug: 'ecommerce', state: 'inactive', healthStatus: 'warning', heldReason: 'capability_drift', manifestCapabilities: ['api', 'scheduler'], approvedCapabilities: ['api'] },
      { slug: 'mlm', state: 'error', healthStatus: 'error', error: 'boom' },
      { slug: 'search', state: 'inactive', healthStatus: 'healthy' },
    ]);
    expect(report.ok).toBe(false);
    expect(report.counts).toEqual({ total: 4, active: 1, held: 1, error: 1, inactive: 1 });
    expect(report.held[0].slug).toBe('ecommerce');
    expect(report.held[0].addedCapabilities).toEqual(['scheduler']);
    expect(report.error[0].slug).toBe('mlm');
  });

  it('ok=true when all active/healthy', () => {
    const report = PluginHealthReportService.buildReport([
      { slug: 'cms', state: 'active', healthStatus: 'healthy' },
    ]);
    expect(report.ok).toBe(true);
    expect(report.counts.held).toBe(0);
  });
});
