import { afterEach, describe, expect, it, vi } from 'vitest';
import { EventDeliveryController } from '@api/controllers/plugins/event-delivery-controller';
import { EventDeliveryLedger } from '@fromcode119/core';

function fakeRes() {
  const res: any = { statusCode: 200, body: undefined };
  res.status = vi.fn((code: number) => { res.statusCode = code; return res; });
  res.json = vi.fn((body: any) => { res.body = body; return res; });
  return res;
}

describe('EventDeliveryController', () => {
  afterEach(() => vi.restoreAllMocks());
  const controller = () => new EventDeliveryController({} as never);

  it('list returns the open failures', async () => {
    vi.spyOn(EventDeliveryLedger, 'listOpenFailures').mockResolvedValue([{ id: 1 } as never]);
    const res = fakeRes();
    await controller().list({} as never, res as never);
    expect(res.json).toHaveBeenCalledWith({ deliveries: [{ id: 1 }] });
  });

  it('retry rejects an invalid id with 400', async () => {
    const res = fakeRes();
    await controller().retry({ params: { id: 'not-a-number' } } as never, res as never);
    expect(res.statusCode).toBe(400);
  });

  it('retry returns 404 when the delivery is gone', async () => {
    vi.spyOn(EventDeliveryLedger, 'retry').mockResolvedValue({ ok: false, notFound: true });
    const res = fakeRes();
    await controller().retry({ params: { id: '5' } } as never, res as never);
    expect(res.statusCode).toBe(404);
  });

  it('retry returns 409 with the reason when the listener still fails', async () => {
    vi.spyOn(EventDeliveryLedger, 'retry').mockResolvedValue({ ok: false, error: 'still broken' });
    const res = fakeRes();
    await controller().retry({ params: { id: '5' } } as never, res as never);
    expect(res.statusCode).toBe(409);
    expect(res.body).toMatchObject({ error: 'still broken' });
  });

  it('retry returns ok on success', async () => {
    vi.spyOn(EventDeliveryLedger, 'retry').mockResolvedValue({ ok: true });
    const res = fakeRes();
    await controller().retry({ params: { id: '5' } } as never, res as never);
    expect(res.body).toMatchObject({ ok: true });
  });
});
