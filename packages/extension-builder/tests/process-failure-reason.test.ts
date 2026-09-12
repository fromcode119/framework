import { describe, expect, it } from 'vitest';
import { ProcessFailureReason } from '@extension-builder/process-failure-reason';

/**
 * The line an operator reads when a build fails.
 *
 * The streams below are REAL — captured from a vite build made to fail on an unresolvable import,
 * not written from memory. Two earlier attempts at this returned the wrong line precisely because
 * the shape was assumed: the last line of stderr is a stack frame, and the last line of stdout is
 * `✓ N modules transformed.`
 */
describe('ProcessFailureReason', () => {
  const VITE_STDERR = `✗ Build failed in 11ms
error during build:
[vite]: Rollup failed to resolve import "totally-missing-package" from "/private/tmp/vite-fail-probe/src/main.js".
This is most likely unintended because it can break your application at runtime.
If you do want to externalize this module explicitly add it to
\`build.rollupOptions.external\`
    at viteLog (file:///Users/kristian/Work/Clients/Fromcode%20119/Domains/fromcode.com/Source/framework/Source/node_modules/vite/dist/node/chunks/config.js:33715:57)
    at onRollupLog (file:///Users/kristian/Work/Clients/Fromcode%20119/Domains/fromcode.com/Source/framework/Source/node_modules/vite/dist/node/chunks/config.js:33745:7)
    at onLog (file:///Users/kristian/Work/Clients/Fromcode%20119/Domains/fromcode.com/Source/framework/Source/node_modules/vite/dist/node/chunks/config.js:33547:4)
    at file:///Users/kristian/Work/Clients/Fromcode%20119/Domains/fromcode.com/Source/framework/Source/node_modules/rollup/dist/es/shared/node-entry.js:20958:32
    at Object.logger [as onLog] (file:///Users/kristian/Work/Clients/Fromcode%20119/Domains/fromcode.com/Source/framework/Source/node_modules/rollup/dist/es/shared/node-entry.js:22945:9)
    at ModuleLoader.handleInvalidResolvedId (file:///Users/kristian/Work/Clients/Fromcode%20119/Domains/fromcode.com/Source/framework/Source/node_modules/rollup/dist/es/shared/node-entry.js:21689:26)
    at file:///Users/kristian/Work/Clients/Fromcode%20119/Domains/fromcode.com/Source/framework/Source/node_modules/rollup/dist/es/shared/node-entry.js:21647:26`;
  const VITE_STDOUT = `vite v7.3.6 building client environment for production...
transforming...
✓ 1 modules transformed.`;

  it('returns the reason from a real vite failure, not a stack frame', () => {
    expect(ProcessFailureReason.from({ stderr: VITE_STDERR, stdout: VITE_STDOUT }))
      .toBe(' — [vite]: Rollup failed to resolve import "totally-missing-package" from "/private/tmp/vite-fail-probe/src/main.js".');
  });

  it('does not return the summary line, which says no more than the exit code', () => {
    expect(ProcessFailureReason.from({ stderr: VITE_STDERR })).not.toContain('Build failed in');
  });

  it('does not return progress from stdout', () => {
    expect(ProcessFailureReason.from({ stdout: VITE_STDOUT })).toBe('');
  });

  it('keeps the header out of the answer while still reading past it', () => {
    // `error during build:` announces the reason rather than being it.
    expect(ProcessFailureReason.from({ stderr: 'error during build:\n[vite]: something broke' }))
      .toBe(' — [vite]: something broke');
  });

  it('is empty when a header is all the tool said', () => {
    expect(ProcessFailureReason.from({ stderr: 'error during build:' })).toBe('');
  });

  it('reads tailwind, whose stderr is one line', () => {
    expect(ProcessFailureReason.from({ stderr: 'Specified config file does not exist.' }))
      .toBe(' — Specified config file does not exist.');
  });

  it('falls back to stdout only when stderr is silent', () => {
    expect(ProcessFailureReason.from({ stdout: 'Specified config file does not exist.', stderr: '' }))
      .toBe(' — Specified config file does not exist.');
  });

  it('names a kill, which is the failure with no output to quote', () => {
    // A vite build killed by the container's memory ceiling writes no stderr at all, so reading it
    // reported nothing and the failure read as a code fault.
    expect(ProcessFailureReason.from({ killed: true, signal: 'SIGKILL', stderr: '', stdout: '' }))
      .toContain('killed (SIGKILL)');
    expect(ProcessFailureReason.from({ killed: true, stderr: '' })).toContain('ran out of memory');
  });

  it('is empty when there is nothing to say, so a caller can append it safely', () => {
    expect(ProcessFailureReason.from(undefined)).toBe('');
    expect(ProcessFailureReason.from({})).toBe('');
  });
});
