export interface DatabaseDialectResolver {
  readonly dialect: string;

  matches(connection: string): boolean;
}