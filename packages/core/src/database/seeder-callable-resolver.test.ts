import { afterEach, describe, expect, it } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { Seeder } from './seeder';
import { SeederCallableResolver } from './seeder-callable-resolver';
import { SeederCallableResolverErrorCodes } from './seeder-callable-resolver-error-codes';

describe('SeederCallableResolver', () => {
  const resolver = new SeederCallableResolver();

  it('prefers default callable over named allowlist symbols', () => {
    const defaultFn = () => 'default';
    const resolution = resolver.resolveCallable({
      default: defaultFn,
      seed: () => 'seed',
      run: () => 'run',
      execute: () => 'execute'
    });

    expect(resolution.callable).toBe(defaultFn);
    expect(resolution.symbolName).toBe('default');
    expect(resolution.sourceType).toBe('default');
  });

  it('uses seed when default callable is absent', () => {
    const seedFn = () => 'seed';
    const resolution = resolver.resolveCallable({ seed: seedFn, run: () => 'run', execute: () => 'execute' });

    expect(resolution.callable).toBe(seedFn);
    expect(resolution.symbolName).toBe('seed');
  });

  it('uses run when default and seed are absent', () => {
    const runFn = () => 'run';
    const resolution = resolver.resolveCallable({ run: runFn, execute: () => 'execute' });

    expect(resolution.callable).toBe(runFn);
    expect(resolution.symbolName).toBe('run');
  });

  it('uses execute when default, seed, and run are absent', () => {
    const executeFn = () => 'execute';
    const resolution = resolver.resolveCallable({ execute: executeFn });

    expect(resolution.callable).toBe(executeFn);
    expect(resolution.symbolName).toBe('execute');
  });

  it('rejects module exports without allowlisted callable symbols', () => {
    try {
      resolver.resolveCallable({ other: () => 'not-allowed' });
      expect.fail('Expected resolver to throw for non-allowlisted callable');
    } catch (error: unknown) {
      expect((error as { code?: string }).code).toBe(SeederCallableResolverErrorCodes.MISSING_SEED_CALLABLE);
    }
  });

  it('rejects non-callable allowlisted symbol', () => {
    try {
      resolver.resolveCallable({ seed: 'not-a-function' });
      expect.fail('Expected resolver to throw for non-callable seed symbol');
    } catch (error: unknown) {
      expect((error as { code?: string }).code).toBe(SeederCallableResolverErrorCodes.NON_CALLABLE_SEED_SYMBOL);
    }
  });
});

describe('Seeder integration with resolver', () => {
  const temporaryFiles: string[] = [];

  afterEach(() => {
    for (const filePath of temporaryFiles) {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }
    temporaryFiles.length = 0;
    (globalThis as any).__SEED_MARKER__ = undefined;
  });

  it('executes allowlisted named seed callable', async () => {
    const seeder = new Seeder({} as any);
    const filePath = path.join(os.tmpdir(), `seeder-valid-${Date.now()}-${Math.random()}.cjs`);
    temporaryFiles.push(filePath);

    fs.writeFileSync(
      filePath,
      [
        'module.exports.seed = async function seed(db, sql) {',
        '  globalThis.__SEED_MARKER__ = Boolean(db) && Boolean(sql);',
        '};'
      ].join('\n'),
      'utf8'
    );

    await seeder.seed(filePath);
    expect((globalThis as any).__SEED_MARKER__).toBe(true);
  });

  it('fails when module only exports a non-allowlisted callable', async () => {
    const seeder = new Seeder({} as any);
    const filePath = path.join(os.tmpdir(), `seeder-invalid-${Date.now()}-${Math.random()}.cjs`);
    temporaryFiles.push(filePath);

    fs.writeFileSync(
      filePath,
      [
        'module.exports.other = async function other() {',
        '  return true;',
        '};'
      ].join('\n'),
      'utf8'
    );

    await expect(seeder.seed(filePath)).rejects.toMatchObject({
      code: SeederCallableResolverErrorCodes.MISSING_SEED_CALLABLE
    });
  });
});