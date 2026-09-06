import type { ISlotComponent } from '@fromcode119/react/interfaces/slot-component.interface';

/**
 * Resolves every code-split override's module BEFORE `hydrateRoot`, so no block boundary suspends
 * during hydration. Measured without it: the cms body registers its blocks on mount, that update reaches
 * boundaries whose `React.lazy` chunks are still in flight, React discards their server markup and
 * renders the null fallback until each chunk lands — every section flashes out and back in, a 0.36 layout
 * shift on the home page at desktop width. With the registrar's cached loaders answering synchronously
 * afterwards, the lazies render in place on the first hydrating pass.
 *
 * Bounded: a chunk that never arrives must not hold the page hostage — after the cap the hydration goes
 * ahead and that one block takes React's client-render path, exactly as before.
 */
export class OverrideLoaderWarmup {
  static readonly TIMEOUT_MS = 3000;

  static async warm(overrides: Record<string, ISlotComponent>, timeoutMs = OverrideLoaderWarmup.TIMEOUT_MS): Promise<number> {
    const loaders = Object.values(overrides).map((entry) => entry?.loader).filter((loader): loader is NonNullable<ISlotComponent['loader']> => typeof loader === 'function');
    if (!loaders.length) return 0;
    let settled = 0;
    const all = Promise.allSettled(loaders.map((loader) => Promise.resolve().then(loader).then(() => { settled += 1; })));
    const cap = new Promise<void>((resolve) => setTimeout(resolve, timeoutMs));
    await Promise.race([all, cap]);
    return settled;
  }
}
