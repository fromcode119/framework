import { describe, expect, it } from 'vitest';
import { ShippedMigration } from '@cli/services/deploy/shipped-migration';

describe('ShippedMigration', () => {
  it('reads the marker line only, past whatever the loader printed before it', () => {
    const stdout = ['[MigrationLoader] Directory missing', '', `${ShippedMigration.MARKER}[[57,false],[58,true]]`, ''].join('\n');
    expect(ShippedMigration.parse(stdout)).toEqual([new ShippedMigration(57, false), new ShippedMigration(58, true)]);
  });

  it('reads nothing when the marker is absent or garbled — never "nothing to migrate" by accident', () => {
    expect(ShippedMigration.parse('Error: Cannot find module')).toEqual([]);
    expect(ShippedMigration.parse(`${ShippedMigration.MARKER}[[57,`)).toEqual([]);
  });

  it('carries no single quote, so it survives the shell quoting it is sent in', () => {
    expect(ShippedMigration.PROBE).not.toContain("'");
  });
});
