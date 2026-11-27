import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import express from 'express';
import request from 'supertest';
import { UploadsCompression } from '@api/server/uploads-compression';

describe('uploads compression', () => {
  const text = 'const value = 1;\n'.repeat(2000);
  let root: string;
  let app: express.Express;

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'uploads-compression-'));
    for (const name of ['app.bundle', 'photo.png']) fs.writeFileSync(path.join(root, name), text);
    app = express();
    app.use('/uploads', UploadsCompression.middleware(), express.static(root));
  });

  afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

  it('gzips a bundle for a client that accepts it, and the bytes come back unchanged', async () => {
    const res = await request(app).get('/uploads/app.bundle').set('Accept-Encoding', 'gzip').buffer(true);
    expect(res.headers['content-encoding']).toBe('gzip');
    expect(res.headers.vary).toContain('Accept-Encoding');
    expect(Buffer.from(res.body).toString()).toBe(text);
  });

  it('sends the file as it is to a client that accepts no encoding', async () => {
    const res = await request(app).get('/uploads/app.bundle').set('Accept-Encoding', 'identity');
    expect(res.headers['content-encoding']).toBeUndefined();
    expect(Number(res.headers['content-length'])).toBe(text.length);
  });

  it('leaves a picture alone', async () => {
    const res = await request(app).get('/uploads/photo.png').set('Accept-Encoding', 'gzip');
    expect(res.headers['content-encoding']).toBeUndefined();
  });

  it('answers a byte range with the file’s own bytes', async () => {
    const res = await request(app).get('/uploads/app.bundle').set('Accept-Encoding', 'gzip').set('Range', 'bytes=0-1999').buffer(true);
    expect(res.status).toBe(206);
    expect(res.headers['content-encoding']).toBeUndefined();
    expect(Number(res.headers['content-length'])).toBe(2000);
  });
});
