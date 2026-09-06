import { afterEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { StorefrontDocumentProxy } from '@/lib/document/storefront-document-proxy';

const request = (path: string, method = 'GET') => new NextRequest(`http://frontend.local${path}`, { method });

describe('StorefrontDocumentProxy', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('passes every request through while the rollout flag is off', () => {
    vi.stubEnv(StorefrontDocumentProxy.FLAG, '');
    expect(StorefrontDocumentProxy.enabled()).toBe(false);
    expect(StorefrontDocumentProxy.handle(request('/')).headers.get('x-middleware-rewrite')).toBeNull();
  });

  it('rewrites the home and content paths to the document route, keeping the query', () => {
    vi.stubEnv(StorefrontDocumentProxy.FLAG, '1');
    expect(StorefrontDocumentProxy.handle(request('/')).headers.get('x-middleware-rewrite')).toBe('http://frontend.local/fc-document');
    expect(StorefrontDocumentProxy.handle(request('/platform?preview=1')).headers.get('x-middleware-rewrite')).toBe('http://frontend.local/fc-document/platform?preview=1');
    expect(StorefrontDocumentProxy.handle(request('/bg/technologies/react')).headers.get('x-middleware-rewrite')).toBe('http://frontend.local/fc-document/bg/technologies/react');
  });

  it('leaves the remaining Next pages, the document route, internals and files alone', () => {
    vi.stubEnv(StorefrontDocumentProxy.FLAG, 'true');
    for (const path of ['/register', '/forgot-password', '/reset-password?token=x', '/verify-email', '/verify-email-change', '/unsubscribe', '/fc-document/x', '/internal/ssr-status', '/api/v1/health', '/_next/static/a.js', '/logo.png', '/robots.txt']) {
      expect(StorefrontDocumentProxy.handle(request(path)).headers.get('x-middleware-rewrite'), path).toBeNull();
    }
  });

  it('never rewrites non-navigation methods', () => {
    vi.stubEnv(StorefrontDocumentProxy.FLAG, '1');
    expect(StorefrontDocumentProxy.handle(request('/contact', 'POST')).headers.get('x-middleware-rewrite')).toBeNull();
  });
});
