import { CoercionUtils } from '@fromcode119/core';
import type { HookManager } from '@fromcode119/core';
import { BuildService } from '@sources/packaging/build-service';
import { BuildSourceIdentity } from '@sources/sources/build-source-identity';

export class BuildSourceDeleteHook {
  static readonly EVENT = 'sources:delete';

  static register(hooks: HookManager, buildService: BuildService): void {
    hooks.on(BuildSourceDeleteHook.EVENT, async (payload: unknown) => {
      const identity = BuildSourceDeleteHook.identityFrom(payload);
      if (!identity) {
        return { success: false };
      }

      await buildService.deleteSource(identity);
      return { success: true };
    });
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
