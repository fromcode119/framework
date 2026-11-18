import { StackSession } from '@cli/services/stack/stack-session';

/** One stack as it exists on disk. */
export interface IStackRecord {
  readonly name: string;
  readonly root: string;
  readonly port: number;
  readonly framework: string;
  readonly createdAt: Date;
  readonly session: StackSession;
}
