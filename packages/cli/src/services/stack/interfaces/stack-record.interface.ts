import { StackSession } from '@cli/services/stack/stack-session';

/** One stack as it exists on disk. */
export interface IStackRecord {
  readonly name: string;
  readonly root: string;
  readonly port: number;
  readonly framework: string;
  /** The image tag it runs on, so a template captured from it can report what it came from. */
  readonly version: string;
  readonly createdAt: Date;
  readonly session: StackSession;
}
