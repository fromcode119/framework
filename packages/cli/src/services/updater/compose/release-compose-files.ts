import { ComposeStack } from '@cli/services/deploy/compose-stack';
import { TarArchiveReader } from '@cli/services/updater/compose/tar-archive-reader';
import type { IDockerEngine } from '@cli/services/updater/interfaces/docker-engine.interface';

/**
 * The deployment folder a release ships, read out of its own api image.
 *
 * Every platform image is built from the repository with its `deploy/` folder in it — the same folder
 * the deploy command checks out of the release tag — so the image already downloaded for the update IS
 * the release's compose files; no second source, no network, nothing that can disagree with the
 * containers. The image's files are copied out of a container that is created and never started.
 */
export class ReleaseComposeFiles {
  static readonly PATH = '/app/deploy';

  constructor(private readonly engine: IDockerEngine, private readonly project: string) {}

  /** The files of `image`'s deployment folder, by path inside it; throws when it ships no compose files. */
  async read(image: string): Promise<Map<string, Buffer>> {
    const id = await this.engine.createContainer(`${this.project}-release-files-${Date.now()}`, {
      Image: image, Entrypoint: ['true'], Cmd: null, Labels: {}, HostConfig: { NetworkMode: 'none' },
    });
    try {
      const files = TarArchiveReader.files(await this.engine.archive(id, ReleaseComposeFiles.PATH));
      const missing = ComposeStack.REQUIRED_FILES.filter((file) => !files.has(file));
      if (missing.length) throw new Error(`${image} ships no ${missing.join(' or ')}.`);
      return files;
    } finally {
      await this.engine.remove(id).catch(() => undefined);
    }
  }
}
