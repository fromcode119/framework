import { describe, expect, it, vi } from 'vitest';
import { EdgeAlerts } from '@core/security/edge/edge-alerts';
import type { IEdgeStopRecord } from '@core/security/edge/interfaces/edge-stop-record.interface';

const stop = (address: string): IEdgeStopRecord => ({
  id: 1, address, reason: 'scanner_stopped', strikes: 5, refused: 0, hosts: ['shop.test'], paths: ['/.env'],
  stoppedAt: '2026-11-24T08:00:00.000Z', until: '2026-11-24T09:00:00.000Z', releasedAt: '', releasedBy: '', releaseAction: '', active: true,
});

describe('EdgeAlerts', () => {
  it('sends the first stop at once and gathers the rest of the hour into one message', async () => {
    vi.useFakeTimers();
    try {
      let now = 0;
      const sent: Array<{ subject: string; text: string }> = [];
      const alerts = new EdgeAlerts({}, () => now, async (message) => { sent.push(message); });
      await alerts.scannerStopped(stop('203.0.113.30'));
      expect(sent).toHaveLength(1);
      expect(sent[0].subject).toContain('203.0.113.30');
      expect(sent[0].text).toContain('/.env');

      now += 60_000;
      await alerts.scannerStopped(stop('203.0.113.31'));
      await alerts.scannerStopped(stop('203.0.113.32'));
      expect(sent).toHaveLength(1);

      now += EdgeAlerts.WINDOW_MS;
      await vi.advanceTimersByTimeAsync(EdgeAlerts.WINDOW_MS);
      expect(sent).toHaveLength(2);
      expect(sent[1].subject).toContain('2 addresses');
      expect(sent[1].text).toContain('203.0.113.31');
      expect(sent[1].text).toContain('203.0.113.32');
      alerts.stop();
    } finally {
      vi.useRealTimers();
    }
  });

  it('always sends a watchdog restart, with its reason', async () => {
    const sent: Array<{ subject: string; text: string }> = [];
    const alerts = new EdgeAlerts({}, () => 0, async (message) => { sent.push(message); });
    await alerts.gatewayRestarted('pool to the frontend stalled', '2026-11-24 01:24:00 UTC');
    await alerts.gatewayRestarted('pool to the frontend stalled', '2026-11-24 01:30:00 UTC');
    expect(sent).toHaveLength(2);
    expect(sent[0].text).toContain('pool to the frontend stalled');
  });

  it('never fails the report when the message cannot be sent', async () => {
    const alerts = new EdgeAlerts({}, () => 0, async () => { throw new Error('no mail'); });
    await expect(alerts.scannerStopped(stop('203.0.113.33'))).resolves.toBeUndefined();
  });
});
