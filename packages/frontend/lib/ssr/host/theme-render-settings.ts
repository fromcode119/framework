import { SystemConstants } from '@fromcode119/core/client';

/**
 * The operator's numbers for theme render hosts, read off the `/system/frontend` payload the render
 * already needed (Settings → Infrastructure → Server rendering). The constants here only mirror the
 * declared settings' own defaults; the payload is the source of truth.
 */
export class ThemeRenderSettings {
  private constructor(
    /** How many worlds — now processes — stay resident. */
    readonly generationCap: number,
    readonly memoryMb: number,
    readonly timeoutMs: number,
  ) {}

  static from(config: Record<string, unknown>): ThemeRenderSettings {
    return new ThemeRenderSettings(
      ThemeRenderSettings.positive(config.ssrGenerationCap, SystemConstants.SSR_GENERATION_CAP_DEFAULT),
      ThemeRenderSettings.positive(config.ssrRenderMemoryMb, SystemConstants.SSR_RENDER_MEMORY_MB_DEFAULT),
      ThemeRenderSettings.positive(config.ssrRenderTimeoutMs, SystemConstants.SSR_RENDER_TIMEOUT_MS_DEFAULT),
    );
  }

  private static positive(value: unknown, fallback: number): number {
    const declared = Number(value);
    return Number.isFinite(declared) && declared >= 1 ? Math.floor(declared) : fallback;
  }
}
