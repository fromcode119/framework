export interface IDatabaseDialectResolver {
  readonly dialect: string;

  matches(connection: string): boolean;
}