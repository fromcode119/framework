import { describe, expect, it } from 'vitest';
import { ServerUploadsStaticSetup } from '@api/server/server-uploads-static-setup';
import { ServedFileHeaderService } from '@api/services/served-file-header-service';

/**
 * An upload is served on every host — the shared admin's included — so a document a site uploaded (an
 * `.html`, an SVG) must render in an opaque origin with no script, or it would run as whoever opened it,
 * a platform administrator included. Every file is served as exactly its declared type (`nosniff`).
 */
describe('uploads are served safely', () => {
  const served = (file: string) => {
    const headers: Record<string, string> = {};
    (ServerUploadsStaticSetup as any).OPTIONS.setHeaders({ setHeader: (name: string, value: string) => { headers[name.toLowerCase()] = value; } }, file);
    return headers;
  };

  it('serves an uploaded HTML page sandboxed, with no script', () => {
    const headers = served('/uploads/site-a/landing.html');
    expect(headers['content-security-policy']).toBe(ServedFileHeaderService.DOCUMENT_POLICY);
    expect(headers['content-security-policy']).toMatch(/sandbox/);
    expect(headers['content-security-policy']).not.toMatch(/script-src/);
    expect(headers['x-content-type-options']).toBe('nosniff');
  });

  it('serves an uploaded SVG as an image, sandboxed', () => {
    const headers = served('/uploads/site-a/logo.SVG');
    expect(headers['content-type']).toBe('image/svg+xml');
    expect(headers['content-security-policy']).toMatch(/sandbox/);
  });

  it('serves an image as its type only, with no document policy', () => {
    const headers = served('/uploads/site-a/photo.webp');
    expect(headers['x-content-type-options']).toBe('nosniff');
    expect(headers['content-security-policy']).toBeUndefined();
  });
});
