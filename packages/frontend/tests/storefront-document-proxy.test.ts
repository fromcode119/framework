import { afterEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { StorefrontDocumentProxy } from '@/lib/document/storefront-document-proxy';

const request = (path: string, method = 'GET') => new NextRequest(`http://frontend.local${path}`, { method });

describe('StorefrontDocumentProxy', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('rewrites content even where an old deployment still sets the retired flag to false', async () => {
    // Production's .env carried STOREFRONT_DOCUMENT_ISLANDS=false; it must not bring back the old path.
    vi.stubEnv('STOREFRONT_DOCUMENT_ISLANDS', 'false');
    expect((await StorefrontDocumentProxy.handle(request('/'))).headers.get('x-middleware-rewrite')).toBe('http://frontend.local/fc-document');
  });

  it('rewrites the home and content paths to the document route, keeping the query', async () => {
    expect((await StorefrontDocumentProxy.handle(request('/'))).headers.get('x-middleware-rewrite')).toBe('http://frontend.local/fc-document');
    expect((await StorefrontDocumentProxy.handle(request('/platform?preview=1'))).headers.get('x-middleware-rewrite')).toBe('http://frontend.local/fc-document/platform?preview=1');
    expect((await StorefrontDocumentProxy.handle(request('/bg/technologies/react'))).headers.get('x-middleware-rewrite')).toBe('http://frontend.local/fc-document/bg/technologies/react');
  });

  it('leaves the remaining Next pages, the document route, internals and files alone', async () => {
    for (const path of ['/register', '/forgot-password', '/reset-password?token=x', '/verify-email', '/verify-email-change', '/unsubscribe', '/fc-document/x', '/internal/ssr-status', '/api/v1/health', '/_next/static/a.js', '/logo.png', '/robots.txt']) {
      expect((await StorefrontDocumentProxy.handle(request(path))).headers.get('x-middleware-rewrite'), path).toBeNull();
    }
  });

  it('never rewrites non-navigation methods', async () => {
    expect((await StorefrontDocumentProxy.handle(request('/contact', 'POST'))).headers.get('x-middleware-rewrite')).toBeNull();
  });
});
