import fs from 'fs';
import os from 'os';
import { execFileSync } from 'child_process';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { StackSession } from '@cli/services/stack/stack-session';
import { StackService } from '@cli/services/stack/stack-service';
import { StackStore } from '@cli/services/stack/stack-store';

/**
 * These cover the one answer that must never be wrong: whether the session that made a stack is
 * still using it. `stack prune` deletes databases on the strength of it.
 */
describe('StackSession', () => {
  const SESSION = '90be340e-800f-4bab-9261-ef62a894a2a1';
  let projects: string;

  beforeEach(() => {
    projects = fs.mkdtempSync(path.join(os.tmpdir(), 'fc-projects-'));
  });

  afterEach(() => {
    fs.rmSync(projects, { recursive: true, force: true });
  });

  /** The transcript lives under a project directory whose name nothing else knows. */
  const writeTranscript = (id: string, mtime: Date, project = 'some-encoded-project-path'): void => {
    const directory = path.join(projects, project);
    fs.mkdirSync(directory, { recursive: true });
    const file = path.join(directory, `${id}.jsonl`);
    fs.writeFileSync(file, '{}\n');
    fs.utimesSync(file, mtime, mtime);
  };

  it('finds the transcript without being told which project directory it is in', () => {
    writeTranscript(SESSION, new Date());

    const session = StackSession.fromWorkingDirectory(`/tmp/claude/${SESSION}/scratchpad/fw/deploy`, projects);

    expect(session.id).toBe(SESSION);
    expect(session.isStale).toBe(false);
  });

  it('reads the id from a UUID segment anywhere in the path, not a fixed position', () => {
    writeTranscript(SESSION, new Date());

    const deep = StackSession.fromWorkingDirectory(`/tmp/claude/${SESSION}/scratchpad/a/b/c/deploy`, projects);

    expect(deep.id).toBe(SESSION);
  });

  it('calls a session stale once it has been quiet longer than the threshold', () => {
    const quiet = new Date(Date.now() - (StackSession.STALE_HOURS + 1) * 3_600_000);
    writeTranscript(SESSION, quiet);

    expect(StackSession.fromWorkingDirectory(`/tmp/${SESSION}/x`, projects).isStale).toBe(true);
  });

  /**
   * The two "cannot tell" cases must both answer NO. Prune reads `isStale`, and deleting somebody's
   * database because a transcript could not be found is the one failure this must not have.
   */
  it('never calls a stack stale when ownership cannot be established', () => {
    expect(StackSession.fromWorkingDirectory('/tmp/no-uuid-here/deploy', projects).isStale).toBe(false);
    expect(StackSession.fromWorkingDirectory(`/tmp/${SESSION}/x`, projects).isStale).toBe(false);
  });
});

describe('StackStore port claiming', () => {
  let home: string;

  beforeEach(() => {
    home = fs.mkdtempSync(path.join(os.tmpdir(), 'fc-home-'));
  });

  afterEach(() => {
    fs.rmSync(home, { recursive: true, force: true });
  });

  it('never hands the same port to two stacks', () => {
    const store = new StackStore(home);

    const first = store.claimPort('one');
    const second = store.claimPort('two');

    expect(second).not.toBe(first);
  });

  it('gives a port back when the stack is taken down', () => {
    const store = new StackStore(home);
    const port = store.claimPort('one');

    store.releasePort(port);

    expect(store.claimPort('two')).toBe(port);
  });

  /** A crash must not burn a port: a claim whose stack no longer exists is reclaimed. */
  it('reclaims a port left behind by a stack that is gone', () => {
    const store = new StackStore(home);
    const port = store.claimPort('vanished');

    // What a crash leaves: a claim on disk, no stack recorded, and old enough not to be starting.
    const lock = path.join(home, '.fromcode-stacks', '.ports', String(port));
    const longAgo = new Date(Date.now() - 60 * 60 * 1000);
    fs.utimesSync(lock, longAgo, longAgo);

    expect(store.exists('vanished')).toBe(false);
    expect(new StackStore(home).claimPort('next')).toBe(port);
  });
});

/**
 * `--framework` defaults to the working directory, so run from `framework/Source` a stack would
 * mount the mirror of main into a container writable — the one tree no session may touch.
 */
describe('StackService shared-checkout guard', () => {
  let repo: string;
  let worktree: string;

  beforeEach(() => {
    repo = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'fc-repo-')));
    const git = (...args: string[]): void => {
      execFileSync('git', ['-C', repo, ...args], { stdio: 'ignore' });
    };
    execFileSync('git', ['init', '-q', '-b', 'main', repo], { stdio: 'ignore' });
    git('config', 'user.email', 'test@example.invalid');
    git('config', 'user.name', 'Test');
    fs.writeFileSync(path.join(repo, 'README'), 'x\n');
    git('add', '-A');
    git('commit', '-qm', 'first');

    worktree = path.join(fs.realpathSync(os.tmpdir()), `fc-wt-${Date.now()}`);
    git('worktree', 'add', '-q', '-b', 'work', worktree);
  });

  afterEach(() => {
    fs.rmSync(worktree, { recursive: true, force: true });
    fs.rmSync(repo, { recursive: true, force: true });
  });

  it('knows the main checkout from one of its worktrees', () => {
    expect(StackService.isSharedCheckout(repo)).toBe(true);
    expect(StackService.isSharedCheckout(worktree)).toBe(false);
  });

  /** Nothing shared to protect, so a plain directory is the caller's own business. */
  it('leaves a directory that is not a checkout alone', () => {
    const plain = fs.mkdtempSync(path.join(os.tmpdir(), 'fc-plain-'));

    expect(StackService.isSharedCheckout(plain)).toBe(false);
    fs.rmSync(plain, { recursive: true, force: true });
  });
});
