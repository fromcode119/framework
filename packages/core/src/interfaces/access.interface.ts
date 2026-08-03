export interface IAccess {
  (args: { req: any; user: any }): boolean | Promise<boolean> | Record<string, any>;
}
