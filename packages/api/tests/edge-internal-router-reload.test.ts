import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import http from 'node:http';
import type net from 'node:net';
import express from 'express';
import { ApiPathUtils, InternalServiceAuth, RouteConstants } from '@fromcode119/core';
import { EdgeInternalRouter } from '@api/routes/edge-internal-router';

/** A scanner the gateway stops reaches the edges in front of it at once, not at the map's next refresh. */
describe('EdgeInternalRouter', () => {
  const previous = process.env[InternalServiceAuth.ENV_KEY];
  let server: http.Server;
  let reloads = 0;
  let isNew = true;

  beforeAll(async () => {
    process.env[InternalServiceAuth.ENV_KEY] = 'edge-internal-router-test-secret-0123456789';
    const stops = { record: async () => ({ isNew }), addRefused: async () => undefined } as any;
    const alerts = { scannerStopped: async () => undefined } as any;
    const app = express();
    app.use(express.json());
    app.use(ApiPathUtils.versioned(''), new EdgeInternalRouter(stops, alerts, { notify: async () => { reloads += 1; return true; } } as any).router);
    server = await new Promise((resolve) => { const s = app.listen(0, () => resolve(s)); });
  });
  afterAll(() => {
    server?.close();
    process.env[InternalServiceAuth.ENV_KEY] = previous;
  });

  const report = (body: unknown) => fetch(`http://127.0.0.1:${(server.address() as net.AddressInfo).port}${ApiPathUtils.versioned(RouteConstants.SEGMENTS.INTERNAL_EDGE_STOPS)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...InternalServiceAuth.requestHeaders() },
    body: JSON.stringify(body),
  });

  it('asks the gateway to reload when a stop is new, and not for one already in force or a refusal count', async () => {
    const stop = { address: '198.51.100.77', reason: 'scanner_stopped', until: new Date(Date.now() + 60_000).toISOString(), strikes: 5 };
    expect((await report({ stop })).status).toBe(200);
    expect(reloads).toBe(1);
    isNew = false;
    expect((await report({ stop })).status).toBe(200);
    expect((await report({ refused: { '198.51.100.77': 3 } })).status).toBe(200);
    expect(reloads).toBe(1);
  });
});
