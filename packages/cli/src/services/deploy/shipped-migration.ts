/**
 * A core migration as the api image of the new release declares it: its version, and whether the
 * release still serving keeps working while it runs (`BaseMigration.rollingSafe`).
 *
 * The image is asked by loading its own migration classes, so the answer is what the code says — never
 * a guess from a file name.
 */
export class ShippedMigration {
  /** Starts the line the image prints, so loader warnings on the same stream are never parsed. */
  static readonly MARKER = '@@migrations ';

  /** Run inside the api image: load every core migration and print `version` + `rollingSafe` per one. */
  static readonly PROBE = [
    'const { MigrationLoader } = require("/app/packages/core/dist/database/migrations/index.js");',
    `const list = MigrationLoader.load().map((m) => [m.version, m.rollingSafe === true]);`,
    `process.stdout.write("\\n${ShippedMigration.MARKER}" + JSON.stringify(list) + "\\n");`,
  ].join(' ');

  constructor(
    readonly version: number,
    readonly rollingSafe: boolean,
  ) {}

  /** The migrations in the probe's output; none when the marker line is missing or unreadable. */
  static parse(stdout: string): ShippedMigration[] {
    const line = stdout.split('\n').find((candidate) => candidate.startsWith(ShippedMigration.MARKER));
    if (!line) return [];
    try {
      const rows = JSON.parse(line.slice(ShippedMigration.MARKER.length)) as Array<[number, boolean]>;
      return rows.map(([version, safe]) => new ShippedMigration(Number(version), safe === true)).filter((m) => m.version > 0);
    } catch {
      return [];
    }
  }
}
