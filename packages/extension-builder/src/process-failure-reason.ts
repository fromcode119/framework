/**
 * What a build tool actually said when it failed.
 *
 * Every tool here is spawned, and a spawn failure carries two things: an exit status, and the
 * tool's own words on stderr. Reporting only the first produces messages nobody can act on —
 * "tailwind exited 9", "Command failed: node .../vite.js build --config ..." — while the one useful
 * line sits in a field nothing reads. Both of those reached an operator's screen.
 */
export class ProcessFailureReason {
  /** The last meaningful line of a tool's output, prefixed for appending to a message. */
  static from(source: { stderr?: unknown; stdout?: unknown } | unknown): string {
    const record = (source ?? {}) as { stderr?: unknown; stdout?: unknown };
    const output = `${String(record.stderr ?? '')}\n${String(record.stdout ?? '')}`;
    const line = output
      .split('\n')
      .map((entry) => entry.trim())
      // Vite prints its error under a blank line and a bare "error during build:" header; neither is
      // the reason, and taking the last non-empty line would otherwise return a stack frame.
      .filter((entry) => entry !== '' && !/^error during build:?$/i.test(entry))
      .pop();
    return line ? ` — ${line}` : '';
  }
}
