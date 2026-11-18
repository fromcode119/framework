import fs from 'fs';
import path from 'path';
import os from 'os';

/**
 * Whether the session that created a stack is still alive.
 *
 * A throwaway stack is only throwaway if something eventually throws it away, and the thing that
 * knows is the session that made it. On 2026-11-18 four stacks of ten containers each were still
 * running from sessions that had ended four to six days earlier — forty containers, and a Docker
 * daemon that took 188 seconds to come up because it restored every one of them.
 *
 * A container records the directory compose ran from, which for these stacks is inside the
 * session's scratchpad. That path carries the session's id, and the id is also the name of its
 * transcript under `~/.claude/projects/<project>/<id>.jsonl`. The transcript's mtime is the last
 * time the session wrote anything, so it answers "is anyone still using this?" without asking the
 * app, without a daemon, and without a registry that can go stale on its own.
 */
export class StackSession {
  /** A session quiet for longer than this is treated as gone. Deliberately generous. */
  static readonly STALE_HOURS = 24;

  private constructor(
    readonly id: string | null,
    readonly lastActivity: Date | null,
  ) {}

  /** No id in the path means the stack was not made by a session — never prune it automatically. */
  static unknown(): StackSession {
    return new StackSession(null, null);
  }

  /**
   * Reads the session out of a scratchpad path.
   *
   * The id is the path segment that is a UUID; taking "the segment after scratchpad" would break
   * the moment a stack lives one directory deeper, which is already the case (`<id>/scratchpad/
   * <name>/deploy`).
   */
  static fromWorkingDirectory(workingDirectory: string, projectsRoot = StackSession.defaultProjectsRoot()): StackSession {
    const id = workingDirectory.split(path.sep).find((segment) => StackSession.UUID.test(segment));
    if (!id) return StackSession.unknown();

    const transcript = StackSession.findTranscript(id, projectsRoot);
    if (!transcript) return new StackSession(id, null);

    return new StackSession(id, fs.statSync(transcript).mtime);
  }

  private static readonly UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  /**
   * The transcript is SEARCHED for, not computed.
   *
   * Its directory is named after the session's own working directory, which is not this one: the
   * CLI is just as likely to be run from inside a worktree, and deriving the name from `cwd` would
   * then look in a directory that does not exist and report every stack as ownerless — which is
   * exactly the answer that must never be wrong, because prune reads it.
   */
  private static findTranscript(id: string, projectsRoot: string): string | null {
    if (!fs.existsSync(projectsRoot)) return null;

    for (const project of fs.readdirSync(projectsRoot)) {
      const candidate = path.join(projectsRoot, project, `${id}.jsonl`);
      if (fs.existsSync(candidate)) return candidate;
    }
    return null;
  }

  /** Every project's transcripts live under one root. */
  static defaultProjectsRoot(home: string = os.homedir()): string {
    return path.join(home, '.claude', 'projects');
  }

  /** Hours since the owning session last wrote, or null when that cannot be established. */
  get idleHours(): number | null {
    if (!this.lastActivity) return null;
    return (Date.now() - this.lastActivity.getTime()) / 3_600_000;
  }

  /**
   * Safe to remove without asking.
   *
   * Unknown ownership and a missing transcript both answer NO. Being unable to tell is not a
   * licence to delete someone's database — prune reports those instead, for a person to decide.
   */
  get isStale(): boolean {
    const idle = this.idleHours;
    return idle !== null && idle > StackSession.STALE_HOURS;
  }

  /** One short phrase for `stack ls`. */
  describe(): string {
    if (!this.id) return 'no owning session';
    if (!this.lastActivity) return `session ${this.id.slice(0, 8)} (no transcript)`;

    const idle = this.idleHours ?? 0;
    const age = idle < 1 ? `${Math.round(idle * 60)}m` : `${Math.round(idle)}h`;
    return `session ${this.id.slice(0, 8)}, quiet ${age}`;
  }
}
