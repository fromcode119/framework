import type { IStructuredNode } from './structured-node.interface';

/** One key/node pair inside an object node's `entries`. */
export interface IStructuredEntry {
  key: string;
  node: IStructuredNode;
}
