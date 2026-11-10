/** An Engine API create body, and the networks to connect after the container exists (a create joins one). */
export interface IContainerBody {
  body: Record<string, any>;
  extraNetworks: Array<[string, Record<string, any>]>;
}
