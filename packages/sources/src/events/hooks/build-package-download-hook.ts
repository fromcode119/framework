import { CoercionUtils } from '@fromcode119/core';
import type { HookManager } from '@fromcode119/core';
import { BuildService } from '@sources/build/build-service';
import { BuildSourceType } from '@sources/sources/enums/build-source-type.enum';

export class BuildPackageDownloadHook {
  static readonly EVENT = 'sources:downloads:resolve';

  static register(hooks: HookManager, buildService: BuildService): void {
    hooks.on(BuildPackageDownloadHook.EVENT, async (payload: unknown) => {
      const request = BuildPackageDownloadHook.readPayload(payload);
      if (!request.slug) {
        return { downloadPath: null };
      }

      const artifact = await buildService.resolvePackageArtifact(request.slug, request.type);
      return { downloadPath: artifact?.downloadPath || null };
    });
  }

  private static readPayload(payload: unknown): { slug: string; type?: BuildSourceType } {
    // SDK coercion, not hand-rolled `typeof` guards: `toObject`/`toString` already handle every shape an
    // untrusted hook payload can arrive in, and `resolve()` normalises anything to a member.
    const record = CoercionUtils.toObject(payload);
    return {
      slug: CoercionUtils.toString(record.slug),
      // Absent stays absent; anything present is normalised by the Enum (unknown -> PLUGIN).
      type: record.type == null ? undefined : BuildSourceType.resolve(record.type),
    };
  }
}
