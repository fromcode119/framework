import { CoercionUtils } from '@fromcode119/core';
import type { HookManager } from '@fromcode119/core';
import { BuildService } from '@sources/packaging/build-service';
import { BuildSourceType } from '@sources/sources/enums/build-source-type.enum';

export class BuildPackageArtifactHook {
  static readonly EVENT = 'sources:packages:resolve';

  static register(hooks: HookManager, buildService: BuildService): void {
    hooks.on(BuildPackageArtifactHook.EVENT, async (payload: unknown) => {
      const request = BuildPackageArtifactHook.readPayload(payload);
      if (!request.slug) {
        return { artifact: null };
      }

      const artifact = await buildService.resolvePackageArtifact(request.slug, request.type);
      return { artifact };
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
