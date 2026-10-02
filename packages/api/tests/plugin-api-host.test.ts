import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import express from 'express';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { PluginApiHost } from '@api/server/plugin-api-host';

/**
 * Plugins' routes moved from one shared router to one router per plugin, picked by the first path
 * segment. Everything a handler sees and every answer must be what the shared router gave: the same
 * route chosen, the same `req.url` / `req.path` / `req.baseUrl` / params, the same fall-through to what
 * comes after the plugin routes. The same routes are mounted both ways and every request compared.
 */
type Host = { get: Function; post: Function; use: Function };

function register(host: Host): void {
  const seen = (label: string) => (req: any, res: any) => res.json({ label, url: req.url, path: req.path, baseUrl: req.baseUrl, originalUrl: req.originalUrl, params: req.params });
  host.get('/shop/products', seen('shop list'));
  host.get('/shop/products/:slug', seen('shop item'));
  host.post('/shop/products', seen('shop create'));
  host.get('/blog/products', seen('blog list'));
  host.get('/blog/:any/deep', (req: any, _res: any, next: any) => next());
  const inner = express.Router();
  inner.get('/feed', seen('blog feed via use'));
  host.use('/blog/', inner);
}

function app(mount: (plugins: express.Router) => void): express.Express {
  const application = express();
  const plugins = express.Router();
  mount(plugins);
  plugins.get('/:pluginSlug/:slug', (req, res) => { res.json({ label: 'after plugins', params: req.params }); });
  application.use('/api/v1/plugins', plugins);
  application.use((_req, res) => { res.status(404).json({ label: 'not found' }); });
  return application;
}

const servers: Server[] = [];
async function listen(application: express.Express): Promise<string> {
  const server = application.listen(0);
  servers.push(server);
  await new Promise((resolve) => server.once('listening', resolve));
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}

let shared = '';
let perPlugin = '';

beforeAll(async () => {
  shared = await listen(app((plugins) => { const router = express.Router(); register(router as unknown as Host); plugins.use(router); }));
  perPlugin = await listen(app((plugins) => { const host = new PluginApiHost(); register(host); plugins.use(host.dispatch); }));
});
afterAll(() => { for (const server of servers) server.close(); });

describe('PluginApiHost', () => {
  it.each([
    ['GET', '/api/v1/plugins/shop/products'],
    ['GET', '/api/v1/plugins/shop/products?limit=20&u=x'],
    ['GET', '/api/v1/plugins/shop/products/bench-10'],
    ['GET', '/api/v1/plugins/SHOP/Products/Bench-10'],
    ['POST', '/api/v1/plugins/shop/products'],
    ['GET', '/api/v1/plugins/blog/products'],
    ['GET', '/api/v1/plugins/blog/feed'],
    ['GET', '/api/v1/plugins/blog/x/deep'],
    ['GET', '/api/v1/plugins/nobody/orders'],
    ['GET', '/api/v1/plugins/shop/unknown'],
    ['GET', '/api/v1/plugins/shop'],
    ['GET', '/api/v1/plugins/'],
    ['DELETE', '/api/v1/plugins/shop/products'],
  ])('%s %s answers exactly as the shared router did', async (method, path) => {
    const [a, b] = await Promise.all([shared, perPlugin].map(async (base) => {
      const response = await fetch(base + path, { method });
      return { status: response.status, body: await response.text() };
    }));
    expect(b).toEqual(a);
  });
});
