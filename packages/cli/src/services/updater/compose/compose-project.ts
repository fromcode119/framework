import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { ComposeStack } from '@cli/services/deploy/compose-stack';
import { ComposeFileMerge } from '@cli/services/updater/compose/compose-file-merge';
import { ComposeInterpolation } from '@cli/services/updater/compose/compose-interpolation';

/**
 * The deployment's compose files as `docker compose` reads them: the same files (the required two, then
 * each `.env` `COMPOSE_FILE` names), merged in that order, substituted from that `.env`.
 *
 * This is what lets the updater start a container the way the deployment DECLARES it rather than the
 * way the container it replaces happened to be started — so a release that changes a memory limit, a
 * log driver or an environment variable changes it on every machine that updates itself.
 */
export class ComposeProject {
  constructor(
    /** The compose project name (`atlantis`): the prefix compose gives networks and volumes. */
    readonly name: string,
    private readonly document: Record<string, any>,
  ) {}

  /** Reads `directory` (the deployment folder as this process sees it). Throws on anything it cannot read. */
  static load(directory: string, name: string): ComposeProject {
    const env = dotenv.parse(ComposeProject.read(directory, '.env', false) ?? '');
    let document: Record<string, any> = {};
    for (const file of ComposeStack.filesFrom(env.COMPOSE_FILE ?? '')) {
      const required = ComposeStack.REQUIRED_FILES.includes(file);
      const text = ComposeProject.read(directory, file, required);
      if (text === null) continue;
      document = ComposeFileMerge.merge(document, ComposeFileMerge.parse(text, file));
    }
    return new ComposeProject(name, new ComposeInterpolation(env).deep(document) as Record<string, any>);
  }

  services(): string[] {
    return Object.keys(this.document.services ?? {});
  }

  /** One service's merged, substituted definition; throws when the files do not declare it. */
  service(service: string): Record<string, any> {
    const definition = this.document.services?.[service];
    if (!ComposeFileMerge.isMap(definition)) throw new Error(`The compose files declare no "${service}" service.`);
    return definition;
  }

  /** The Docker network a compose network is: its `name:`, else `<project>_<key>`. */
  networkName(key: string): string {
    return String(this.document.networks?.[key]?.name || `${this.name}_${key}`);
  }

  /** The Docker volume a named compose volume is: its `name:`, else `<project>_<key>`. */
  volumeName(key: string): string | null {
    if (!(key in (this.document.volumes ?? {}))) return null;
    return String(this.document.volumes?.[key]?.name || `${this.name}_${key}`);
  }

  private static read(directory: string, file: string, required: boolean): string | null {
    try {
      return fs.readFileSync(path.join(directory, file), 'utf8');
    } catch (error) {
      if (!required) return null;
      throw new Error(`Cannot read ${file} in the deployment folder: ${(error as Error).message}`);
    }
  }
}
