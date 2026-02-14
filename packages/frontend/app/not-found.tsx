"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Override } from '@fromcode/react';

function NotFoundFallback() {
  return (
    <div
      style={{
        minHeight: '60vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem 1rem'
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 680,
          border: '1px solid color-mix(in srgb, var(--foreground, #111) 10%, transparent)',
          borderRadius: 16,
          padding: '2rem',
          background: 'color-mix(in srgb, var(--background, #fff) 94%, #000 6%)',
          textAlign: 'center'
        }}
      >
        <div
          style={{
            fontSize: '0.75rem',
            fontWeight: 700,
            letterSpacing: '0.16em',
            textTransform: 'uppercase',
            opacity: 0.7
          }}
        >
          Error 404
        </div>
        <h1
          style={{
            margin: '0.65rem 0 0.85rem',
            fontSize: 'clamp(1.6rem, 4vw, 2.4rem)',
            fontWeight: 800,
            lineHeight: 1.2,
            color: 'var(--foreground, #111)'
          }}
        >
          Page not found
        </h1>
        <p
          style={{
            margin: '0 auto 1.4rem',
            maxWidth: 520,
            opacity: 0.8,
            color: 'var(--foreground, #111)'
          }}
        >
          The URL you opened does not match any published route.
        </p>
        <Link
          href="/"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 10,
            padding: '0.65rem 1rem',
            fontWeight: 700,
            textDecoration: 'none',
            color: '#fff',
            background: '#2563eb'
          }}
        >
          Return Home
        </Link>
      </div>
    </div>
  );
}

export default function NotFound() {
  const path = usePathname();
  return (
    <Override name="frontend.page.404" props={{ path }} fallback={<NotFoundFallback />} />
  );
}
