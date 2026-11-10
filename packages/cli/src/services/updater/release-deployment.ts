import { ComposeContainerBody } from '@cli/services/updater/compose/compose-container-body';
import { ComposeProject } from '@cli/services/updater/compose/compose-project';
import { ReleaseComposeFiles } from '@cli/services/updater/compose/release-compose-files';
import { ContainerCopyBody } from '@cli/services/updater/container-copy-body';
import type { ComposeDirectory } from '@cli/services/updater/compose/compose-directory';
import type { IContainerBodySource } from '@cli/services/updater/interfaces/container-body-source.interface';
import type { IContainerSummary } from '@cli/services/updater/interfaces/container-summary.interface';
import type { IDockerEngine } from '@cli/services/updater/interfaces/docker-engine.interface';
import type { IVersionFile } from '@cli/services/updater/interfaces/version-file.interface';

/**
 * The deployment folder brought to a release before any container changes: its compose files, its
 * `.env` `VERSION`, and from those the configuration each new container is started with.
 *
 * This is what makes a release's compose change — a memory limit, the journald log driver, an
 * environment variable — reach a machine that updates itself. It used to start every container as a copy
 * of the one it replaced, so a machine kept the compose settings of the first version it installed
 * however many releases it took. Now the release's files are written first and every new container is
 * built from them, as `docker compose up` on that machine would build it.
 *
 * And it is the way back: the folder's previous files and `VERSION` are restored by `restore()`, and
 * `previous` builds the containers a rollback starts from those files.
 */
export class ReleaseDeployment {
  private previousVersion = '';
  private applied = false;

  constructor(
    private readonly engine: IDockerEngine,
    private readonly directory: ComposeDirectory,
    private readonly versionFile: IVersionFile,
    private readonly project: string,
    private readonly onStep: (step: string) => void,
  ) {}

  /**
   * Writes the release's files and `VERSION`, and proves every service being replaced can be built
   * from them. Throws — with the folder restored — when they cannot: nothing has been stopped yet.
   */
  async prepare(tag: string, replacedTag: string, targets: IContainerSummary[], serviceOf: (target: IContainerSummary) => string): Promise<{ release: IContainerBodySource; previous: IContainerBodySource }> {
    const api = targets.find((target) => serviceOf(target) === 'api');
    if (!api) throw new Error('No api container runs, and the release\'s compose files are read from its image.');
    const files = await new ReleaseComposeFiles(this.engine, this.project).read(`${api.Image.slice(0, api.Image.lastIndexOf(':'))}:${tag}`);
    const previous = await this.previousSource(replacedTag, targets, serviceOf);

    this.previousVersion = this.versionFile.read();
    this.applied = true;
    try {
      this.versionFile.write(tag);
      const changed = this.directory.apply(files);
      this.onStep(changed.length ? `Deployment files from ${tag}: ${changed.join(', ')}` : `Deployment files already match ${tag}`);
      const release = new ComposeContainerBody(ComposeProject.load(this.directory.directory, this.project));
      await this.buildsEvery(release, targets, serviceOf);
      return { release, previous };
    } catch (error) {
      this.restore();
      throw error;
    }
  }

  /** Puts the folder's previous files and `VERSION` back (an install that named none names none again). */
  restore(): void {
    if (!this.applied) return;
    this.directory.restore();
    if (this.previousVersion) this.versionFile.write(this.previousVersion); else this.versionFile.clear();
    this.applied = false;
  }

  /**
   * The containers a rollback starts: from the files the folder holds now, before the release's are
   * written. A folder whose files cannot be read gets a copy of what runs — still exactly the way back.
   */
  private async previousSource(replacedTag: string, targets: IContainerSummary[], serviceOf: (target: IContainerSummary) => string): Promise<IContainerBodySource> {
    try {
      const previous = new ComposeContainerBody(ComposeProject.load(this.directory.directory, this.project));
      await this.buildsEvery(previous, targets, serviceOf);
      return previous;
    } catch (error) {
      this.onStep(`The current compose files cannot be read (${(error as Error).message}); a rollback would copy the running containers`);
      return new ContainerCopyBody(this.engine, replacedTag);
    }
  }

  private async buildsEvery(source: IContainerBodySource, targets: IContainerSummary[], serviceOf: (target: IContainerSummary) => string): Promise<void> {
    for (const target of targets) {
      const template = await this.engine.inspect(target.Id);
      await source.build(serviceOf(target), template.Name.replace(/^\//, ''), 1, template);
    }
  }
}
