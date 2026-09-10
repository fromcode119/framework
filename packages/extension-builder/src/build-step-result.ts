/**
 * What one build step did.
 *
 * A step that does nothing MUST say why. Silence is what let `build-plugins.sh` call a renamed
 * package for a week: the call was wrapped in `>/dev/null 2>&1 || true`, so every plugin-UI and
 * theme build failed while `pack` still exited 0 and shipped a stale `ui/`.
 */
export class BuildStepResult {
  private constructor(
    readonly step: string,
    readonly failed: boolean,
    readonly skippedReason?: string,
    readonly message?: string,
  ) {}

  static ok(step: string): BuildStepResult {
    return new BuildStepResult(step, false);
  }

  /** `reason` is required, and must never be empty — that is the whole point of this class. */
  static skipped(step: string, reason: string): BuildStepResult {
    if (!reason.trim()) throw new Error(`A skipped step must state why: ${step}`);
    return new BuildStepResult(step, false, reason);
  }

  static failure(step: string, message: string): BuildStepResult {
    return new BuildStepResult(step, true, undefined, message);
  }
}
