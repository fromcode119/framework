/**
 * What a build tool actually said when it failed.
 *
 * Every tool here is spawned, and a spawn failure carries an exit status plus the tool's own words.
 * Reporting only the status produces messages nobody can act on — "tailwind exited 9", "Command
 * failed: node .../vite.js build --config ..." — while the one useful line sits on `stderr` where
 * nothing read it. Both of those reached an operator's screen.
 *
 * The shape of a real failure, captured from vite rather than assumed:
 *
 *     ✗ Build failed in 11ms                                    <- a SUMMARY: that it failed
 *     error during build:                                       <- a HEADER: the reason follows
 *     [vite]: Rollup failed to resolve import "sharp" from ...   <- the reason
 *         at viteLog (file:///...)                              <- and nine more frames
 *
 * So the reason is neither the first line nor the last. Taking the last returns a stack frame;
 * taking the first returns "✗ Build failed in 11ms", which says no more than the exit code did.
 * What is wanted is the first line that is not a summary, a header, a frame or progress chatter.
 */
export class ProcessFailureReason {
  /** Says THAT it failed. True and useless — the exit status already carried that much. */
  private static readonly SUMMARY = [/^✗/, /^build failed\b/i];

  /** Announces the reason rather than being it, so the line after one is what we are looking for. */
  private static readonly HEADER = [/^error during build:?$/i, /^error:?$/i];

  /** Where it failed inside the tool, which is the tool's business and not the operator's. */
  private static readonly FRAME = [/^at\s/, /^\s*at\s/];

  /** The tool narrating its own progress; a failing build still prints all of it first. */
  private static readonly PROGRESS = [/^vite v/i, /^✓/, /^transforming/i, /^rendering chunks/i, /^computing gzip/i, /^building for/i, /environment for production/i];

  /** The reason, prefixed for appending to a message. Empty when the tool said nothing usable. */
  static from(source: { stderr?: unknown; stdout?: unknown } | unknown): string {
    const record = (source ?? {}) as { stderr?: unknown; stdout?: unknown; killed?: unknown; signal?: unknown };

    /*
     * A KILLED child explains itself by having said nothing.
     *
     * It is the one failure with no output to quote — the process was stopped before it could write
     * any — so reading its empty stderr and reporting nothing turns the most diagnosable failure
     * there is into the least. A vite build of the cms plugin was being killed by the container's
     * 768 MB ceiling and arrived as a bare "vite build (admin)", which reads as a code fault.
     */
    if (record.killed === true || (typeof record.signal === 'string' && record.signal)) {
      const signal = typeof record.signal === 'string' && record.signal ? ` (${record.signal})` : '';
      return ` — the process was killed${signal}, which usually means it ran out of memory;`
        + ' raise the container\'s memory limit or build fewer extensions at once';
    }

    // stderr first and on its own: a tool that wrote there is saying why it failed, while its stdout
    // ends with progress — concatenating the two returned "✓ 455 modules transformed." as the cause.
    const reason = ProcessFailureReason.firstMeaningful(String(record.stderr ?? ''))
      ?? ProcessFailureReason.firstMeaningful(String(record.stdout ?? ''));
    return reason ? ` — ${reason}` : '';
  }

  private static firstMeaningful(output: string): string | null {
    const ignored = [
      ...ProcessFailureReason.SUMMARY,
      ...ProcessFailureReason.HEADER,
      ...ProcessFailureReason.FRAME,
      ...ProcessFailureReason.PROGRESS,
    ];
    for (const line of output.split('\n').map((entry) => entry.trim())) {
      if (line === '') continue;
      if (ignored.some((pattern) => pattern.test(line))) continue;
      return line;
    }
    return null;
  }
}
