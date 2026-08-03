import Link from 'next/link';
import type { CSSProperties, ReactNode } from 'react';
import { PureReactor } from '@fromcode119/reactor';

/**
 * The framework's own 404 body, used when no theme override is registered.
 *
 * Styles are `private static readonly` members rather than inline literals or module constants. They
 * stay in TS rather than a stylesheet because this renders BEFORE any theme CSS is guaranteed to be
 * present — an unstyled 404 is the failure mode a stylesheet would introduce here.
 */
export class NotFoundFallback extends PureReactor {
  private static readonly OUTER: CSSProperties = {
    minHeight: '60vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '2rem 1rem',
  };

  private static readonly CARD: CSSProperties = {
    width: '100%',
    maxWidth: 680,
    border: '1px solid color-mix(in srgb, var(--foreground, #111) 10%, transparent)',
    borderRadius: 16,
    padding: '2rem',
    background: 'color-mix(in srgb, var(--background, #fff) 94%, #000 6%)',
    textAlign: 'center',
  };

  private static readonly EYEBROW: CSSProperties = {
    fontSize: '0.75rem',
    fontWeight: 700,
    letterSpacing: '0.16em',
    textTransform: 'uppercase',
    opacity: 0.7,
  };

  private static readonly HEADING: CSSProperties = {
    margin: '0.65rem 0 0.85rem',
    fontSize: 'clamp(1.6rem, 4vw, 2.4rem)',
    fontWeight: 800,
    lineHeight: 1.2,
    color: 'var(--foreground, #111)',
  };

  private static readonly BODY: CSSProperties = {
    margin: '0 auto 1.4rem',
    maxWidth: 520,
    opacity: 0.8,
    color: 'var(--foreground, #111)',
  };

  private static readonly ACTION: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    padding: '0.65rem 1rem',
    fontWeight: 700,
    textDecoration: 'none',
    color: '#fff',
    background: '#2563eb',
  };

  render(): ReactNode {
    return (
      <div style={NotFoundFallback.OUTER}>
        <div style={NotFoundFallback.CARD}>
          <div style={NotFoundFallback.EYEBROW}>Error 404</div>
          <h1 style={NotFoundFallback.HEADING}>Page not found</h1>
          <p style={NotFoundFallback.BODY}>The URL you opened does not match any published route.</p>
          <Link href="/" style={NotFoundFallback.ACTION}>Return Home</Link>
        </div>
      </div>
    );
  }
}
