import { describe, expect, it } from 'vitest';
import { brotliDecompressSync, gunzipSync } from 'node:zlib';
import { DocumentCompression } from '@/lib/document/document-compression';

const html = `<!DOCTYPE html><html><body>${'<p>The same paragraph, repeated.</p>'.repeat(200)}</body></html>`;

describe('DocumentCompression', () => {
  it('prefers brotli, falls back to gzip, else identity — and every variant decodes to the same document', () => {
    const br = DocumentCompression.encode(html, 'gzip, deflate, br');
    expect(br.encoding).toBe('br');
    expect(brotliDecompressSync(br.body).toString('utf8')).toBe(html);
    expect(br.body.length).toBeLessThan(html.length / 5);
    const gz = DocumentCompression.encode(html, 'gzip');
    expect(gz.encoding).toBe('gzip');
    expect(gunzipSync(gz.body).toString('utf8')).toBe(html);
    const plain = DocumentCompression.encode(html, null);
    expect(plain.encoding).toBe('');
    expect(Buffer.from(plain.body).toString('utf8')).toBe(html);
  });

  it('sets the content type, the encoding when any, and Vary', () => {
    expect(DocumentCompression.headers('br')).toEqual({ 'Content-Type': 'text/html; charset=utf-8', Vary: 'Accept-Encoding', 'Content-Encoding': 'br' });
    expect(DocumentCompression.headers('')).toEqual({ 'Content-Type': 'text/html; charset=utf-8', Vary: 'Accept-Encoding' });
  });
});
