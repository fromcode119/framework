import { describe, expect, it } from 'vitest';
import { ProcessFailureReason } from '@extension-builder/process-failure-reason';

/**
 * The line an operator reads when a build fails.
 *
 * "tailwind exited 9" and "Command failed: node .../vite.js build --config ..." both reached a
 * screen, and neither says anything actionable — the reason was on the error and nothing read it.
 */
describe('ProcessFailureReason', () => {
  it('prefers stderr, because stdout ends with progress', () => {
    const reason = ProcessFailureReason.from({
      stdout: 'vite v5.0.0 building for production...\ntransforming...\n✓ 455 modules transformed.',
      stderr: 'error during build:\n[vite]: Rollup failed to resolve import "sharp"',
    });

    expect(reason).toBe(' — [vite]: Rollup failed to resolve import "sharp"');
  });

  it('does not return a tick and a count as the reason', () => {
    // The first attempt did exactly this: last non-empty line of stdout+stderr concatenated.
    expect(ProcessFailureReason.from({ stdout: '✓ 455 modules transformed.', stderr: '' })).toBe('');
  });

  it('falls back to stdout when the tool said nothing on stderr', () => {
    expect(ProcessFailureReason.from({ stdout: 'Specified config file does not exist.', stderr: '' }))
      .toBe(' — Specified config file does not exist.');
  });

  it('drops vite\'s bare header, which is not the cause', () => {
    expect(ProcessFailureReason.from({ stderr: 'error during build:' })).toBe('');
  });

  it('is empty when there is nothing to say, so a caller can append it safely', () => {
    expect(ProcessFailureReason.from(undefined)).toBe('');
    expect(ProcessFailureReason.from({})).toBe('');
  });
});
