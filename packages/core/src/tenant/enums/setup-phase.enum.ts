import { Enum } from '@fromcode119/react-class-components/lang';

/**
 * Which question the first-run wizard is currently asking.
 *
 * The two are separated by a process restart, not by a button: a deployment with no connection
 * string cannot open a database, and the connection is opened in `PluginManager`'s constructor
 * before any HTTP server exists. So the database phase runs in a process that has almost nothing
 * wired, writes the answer to disk, and exits; the platform phase is the normal boot that follows.
 *
 * The restart resets the claim and the fifteen-minute window along with the process. That is a
 * deliberate trade and not a hidden one: the window restarting is correct (the clock should measure
 * how long THIS question has been open), while the claim not carrying across means the platform
 * phase is claimable again for the seconds the container takes to come back. It is the same exposure
 * a fresh install already has, and the wizard says so on screen.
 */
export class SetupPhase extends Enum {
  /** No connection string anywhere: asking which database, and where. */
  static readonly DATABASE = new SetupPhase('database');

  /** The database is known and migrated: the original wizard — language, account, platform, domain. */
  static readonly PLATFORM = new SetupPhase('platform');

  private constructor(value: string) {
    super(value);
  }

  get isDatabase(): boolean {
    return this === SetupPhase.DATABASE;
  }
}
