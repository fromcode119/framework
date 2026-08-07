/**
 * Shared setup for the `admin-dom` vitest project (every `packages/admin/**\/*.test.tsx`).
 *
 * Everything here is a jsdom capability gap, NOT a per-suite concern — which is why it lives in ONE
 * shared setup instead of being copy-pasted into each test file. A per-file stub is how these gaps
 * stayed invisible: a suite that forgot the copy simply failed, and a suite nobody ran stayed dark.
 */
import { vi } from 'vitest';

/**
 * Registers `@testing-library/jest-dom`'s matchers (`toBeInTheDocument`, `toHaveClass`, …) on vitest's
 * `expect`. Without it those read as "Invalid Chai property" — which nobody saw, because until now no
 * vitest project collected `.tsx` files and every DOM suite was dark.
 */
import '@testing-library/jest-dom/vitest';

/**
 * jsdom ships no `window.matchMedia`, so any component that asks about the viewport throws
 * `TypeError: window.matchMedia is not a function`. That is what killed both admin RBAC-nav tests
 * (`Sidebar.syncBodyScrollLock` reads `(min-width: 1024px)` to decide whether to lock body scroll).
 *
 * This does NOT answer a blanket `matches: false` — a stub that always says "no" makes viewport
 * branches untestable and can make a test pass for the wrong reason. It evaluates `min-width` /
 * `max-width` against jsdom's real `window.innerWidth`, so a suite can set `window.innerWidth` and
 * genuinely exercise the desktop branch. Anything it cannot evaluate reports `false` rather than
 * guessing.
 */
class JsdomMediaQueryList implements MediaQueryList {
  readonly media: string;
  onchange: MediaQueryList['onchange'] = null;

  private readonly listeners = new Set<(event: MediaQueryListEvent) => void>();

  constructor(media: string) {
    this.media = String(media ?? '');
  }

  get matches(): boolean {
    const width = Number(window.innerWidth);
    if (!Number.isFinite(width)) return false;

    const min = /\(\s*min-width\s*:\s*(\d+(?:\.\d+)?)px\s*\)/i.exec(this.media);
    if (min) return width >= Number(min[1]);

    const max = /\(\s*max-width\s*:\s*(\d+(?:\.\d+)?)px\s*\)/i.exec(this.media);
    if (max) return width <= Number(max[1]);

    // Not a width query (prefers-color-scheme, orientation, …). jsdom has no answer, so report the
    // negative rather than inventing one — an invented `true` is indistinguishable from real support.
    return false;
  }

  addEventListener(_type: 'change', listener: (event: MediaQueryListEvent) => void): void {
    this.listeners.add(listener);
  }

  removeEventListener(_type: 'change', listener: (event: MediaQueryListEvent) => void): void {
    this.listeners.delete(listener);
  }

  /** Deprecated Safari-era API some libraries still feature-detect. */
  addListener(listener: (event: MediaQueryListEvent) => void): void {
    this.listeners.add(listener);
  }

  removeListener(listener: (event: MediaQueryListEvent) => void): void {
    this.listeners.delete(listener);
  }

  dispatchEvent(event: Event): boolean {
    this.listeners.forEach((listener) => listener(event as MediaQueryListEvent));
    this.onchange?.call(this, event as MediaQueryListEvent);
    return true;
  }
}

if (typeof window !== 'undefined' && !window.matchMedia) {
  window.matchMedia = (media: string): MediaQueryList => new JsdomMediaQueryList(media);
}

/**
 * jsdom mounts no Next.js app router, so the first component that calls `useRouter()` throws
 * `invariant expected app router to be mounted` and takes the whole suite with it — which is what
 * kept `appearance-shell-host.test.tsx` red (`ClientLayoutAuthStateHooks.useState` calls `useRouter`).
 *
 * The router is app infrastructure, not the thing under test, so it is stubbed once here. Navigation
 * methods are `vi.fn()` so a suite that DOES care can assert on them via `useRouter()`. A suite that
 * needs different routing values still declares its own `vi.mock('next/navigation', …)`; a test
 * file's own mock takes precedence over this one.
 */
vi.mock('next/navigation', () => {
  const router = {
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  };

  return {
    useRouter: () => router,
    usePathname: () => '/',
    useSearchParams: () => new URLSearchParams(),
    useParams: () => ({}),
    useSelectedLayoutSegment: () => null,
    useSelectedLayoutSegments: () => [],
    // Next's real control-flow helpers throw; keep that contract so a caller relying on them to abort
    // rendering does not silently fall through to code that should never have been reached.
    redirect: (url: string) => {
      throw new Error(`NEXT_REDIRECT:${url}`);
    },
    notFound: () => {
      throw new Error('NEXT_NOT_FOUND');
    },
  };
});
