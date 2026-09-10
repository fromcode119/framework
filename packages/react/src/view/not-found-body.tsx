import type { CSSProperties, ComponentType, ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/react-class-components';

/**
 * The framework's own 404 body — Next-free, so the SAME component renders in the App Router page
 * (`NotFoundFallback`, which lends it `next/link`), in the theme's server render of a 404 document, and
 * in the storefront runtime that hydrates it. One markup for all three, or the 404 could never hydrate.
 *
 * Styles are `private static readonly` members rather than a stylesheet because this renders BEFORE any
 * theme CSS is guaranteed to be present — an unstyled 404 is the failure mode a stylesheet would introduce.
 */
export class NotFoundBody extends PureReactor {
  /** The link element for the home action — `next/link` under the App Router, a plain anchor elsewhere. */
  @prop declare linkComponent?: ComponentType<any> | string;

  private static readonly OUTER: CSSProperties = { minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem 1rem' };

  private static readonly CARD: CSSProperties = {
    width: '100%', maxWidth: 680, borderRadius: 16, padding: '2rem', textAlign: 'center',
    border: '1px solid color-mix(in srgb, var(--foreground, #111) 10%, transparent)',
    background: 'color-mix(in srgb, var(--background, #fff) 94%, #000 6%)',
  };

  private static readonly EYEBROW: CSSProperties = { fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', opacity: 0.7 };

  private static readonly HEADING: CSSProperties = { margin: '0.65rem 0 0.85rem', fontSize: 'clamp(1.6rem, 4vw, 2.4rem)', fontWeight: 800, lineHeight: 1.2, color: 'var(--foreground, #111)' };

  private static readonly BODY: CSSProperties = { margin: '0 auto 1.4rem', maxWidth: 520, opacity: 0.8, color: 'var(--foreground, #111)' };

  private static readonly ACTION: CSSProperties = {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: 10, padding: '0.65rem 1rem',
    fontWeight: 700, textDecoration: 'none', color: '#fff', background: '#2563eb',
  };

  render(): ReactNode {
    const Action = (this.linkComponent || 'a') as ComponentType<any>;
    return (
      <div style={NotFoundBody.OUTER}>
        <div style={NotFoundBody.CARD}>
          <div style={NotFoundBody.EYEBROW}>Error 404</div>
          <h1 style={NotFoundBody.HEADING}>Page not found</h1>
          <p style={NotFoundBody.BODY}>The URL you opened does not match any published route.</p>
          <Action href="/" style={NotFoundBody.ACTION}>Return Home</Action>
        </div>
      </div>
    );
  }
}
