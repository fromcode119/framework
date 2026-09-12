/**
 * What a build tool actually said when it failed.
 *
 * Every tool here is spawned, and a spawn failure carries two things: an exit status, and the
 * tool's own words. Reporting only the first produces messages nobody can act on — "tailwind
 * exited 9", "Command failed: node .../vite.js build --config ..." — while the one useful line sits
 * in a field nothing reads. Both reached an operator's screen.
 */
export class ProcessFailureReason {
  /**
   * Lines that are the tool talking about its progress, not about what went wrong.
   *
   * Taking the last non-empty line looks right and is not: a failing vite build ends its STDOUT with
   * `✓ 455 modules transformed.`, so the "reason" came back as a tick and a count while the error
   * sat on stderr.
   */
  private static readonly NOISE = [
    /^error during build:?$/i,
    /^vite v/i,
    /^✓/,
    /^transforming/i,
    /^rendering chunks/i,
    /^computing gzip/i,
    /^building for/i,
  ];

  /** The last meaningful line of a tool's output, prefixed for appending to a message. */
  static from(source: { stderr?: unknown; stdout?: unknown } | unknown): string {
    const record = (source ?? {}) as { stderr?: unknown; stdout?: unknown };
    // STDERR first and on its own: a tool that wrote to it is telling you why it failed, and its
    // stdout is progress that happens to come last.
    const line = ProcessFailureReason.lastMeaningful(String(record.stderr ?? ''))
      ?? ProcessFailureReason.lastMeaningful(String(record.stdout ?? ''));
    return line ? ` — ${line}` : '';
  }

  private static lastMeaningful(output: string): string | null {
    const lines = output
      .split('\n')
      .map((entry) => entry.trim())
      .filter((entry) => entry !== '' && !ProcessFailureReason.NOISE.some((pattern) => pattern.test(entry)));
    return lines.length ? lines[lines.length - 1] : null;
  }
}
