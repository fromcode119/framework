import semver from 'semver';
import type { IPluginManifest } from '@core/plugin/interfaces/plugin-manifest.interface';

/** Whether a plugin's declared core requirement is met, and by what. */
export interface IPluginCoreCompatibility {
  /** True when the plugin may run on `running` — including when it declares no requirement. */
  ok: boolean;
  /** The declared semver RANGE for the core, or null when the manifest declares none. */
  required: string | null;
  /** The core version this installation runs, as read. */
  running: string;
}

/**
 * One place that answers "can this plugin run on this core?". A plugin may declare `engines.core` — a
 * semver range such as ">=0.2.603" — stamped at release from the SDK it was built against. The installer
 * refuses an update whose requirement the running core does not meet, and the boot path HOLDS such a
 * plugin instead of loading it, so one plugin that outran the core cannot take the whole bundle down
 * with a broken import (see gotcha: plugin auto-update outruns core).
 *
 * Fail OPEN, never closed: a manifest with no requirement, or a running version we cannot parse, is
 * treated as compatible. The gate exists to stop a KNOWN mismatch, not to block on our own uncertainty.
 */
export class PluginCoreCompatibility {
  static check(manifest: Pick<IPluginManifest, 'engines'> | null | undefined, runningCore: string): IPluginCoreCompatibility {
    const required = String(manifest?.engines?.core ?? '').trim() || null;
    const running = String(runningCore ?? '').trim();
    if (!required) return { ok: true, required: null, running };

    // The running version may carry a build/prerelease suffix; coerce to a clean x.y.z for the test, and
    // if it still will not parse, do not block (fail open).
    const coerced = semver.coerce(running)?.version ?? running;
    if (!semver.valid(coerced)) return { ok: true, required, running };
    if (!semver.validRange(required)) return { ok: true, required, running };

    return { ok: semver.satisfies(coerced, required, { includePrerelease: true }), required, running };
  }

  /** The operator-facing reason, naming the fix. Used in the hold notice and the refused-update error. */
  static message(slug: string, compatibility: IPluginCoreCompatibility): string {
    return `"${slug}" needs core ${compatibility.required}, but this installation runs ${compatibility.running}. `
      + `Update the core first (Settings → Updates), then this plugin.`;
  }
}
