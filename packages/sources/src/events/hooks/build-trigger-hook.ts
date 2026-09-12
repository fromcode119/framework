import { CoercionUtils } from '@fromcode119/core';
import type { HookManager } from '@fromcode119/core';
import { BuildService } from '@sources/packaging/build-service';
import { BuildSourceIdentity } from '@sources/sources/build-source-identity';

export class BuildTriggerHook {
  static readonly EVENT = 'sources:builds:trigger';

  static register(hooks: HookManager, buildService: BuildService): void {
    hooks.on(BuildTriggerHook.EVENT, async (payload: unknown) => {
      // An EMPTY payload still means "build everything" — that is a different request, not an
      // incomplete one. A payload that names a source must name it fully.
      if (!BuildTriggerHook.namesASource(payload)) {
        const results = await buildService.buildAll();
        return { results, success: true };
      }

      const identity = BuildTriggerHook.identityFrom(payload);
      if (!identity) {
        return { success: false };
      }

      const result = await buildService.buildSource(identity);
      return { result, success: result.success };
    });
  }

  /** Whether the caller is asking about ONE source, however badly. */
  private static namesASource(payload: unknown): boolean {
    const record = CoercionUtils.toObject(payload);
    return Boolean(CoercionUtils.toString(record.slug).trim());
  }

  /**
   * The source a payload names, or null when it names none.
   *
   * BOTH halves are required. A payload carrying only a slug used to be enough, and the kind was
   * either guessed (`resolve` answers PLUGIN for anything) or left out of the lookup entirely — so
   * "resolve tagiqx" could hand back the plugin when the caller meant the theme. A caller that does
   * not say which kind is asking an ambiguous question, and gets a refusal rather than a guess.
   */
  private static identityFrom(payload: unknown): BuildSourceIdentity | null {
    const record = CoercionUtils.toObject(payload);
    try {
      return BuildSourceIdentity.parse(record.type, record.slug);
    } catch {
      return null;
    }
  }
}
