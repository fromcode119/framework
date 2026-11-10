import type { IContainerBody } from '@cli/services/updater/interfaces/container-body.interface';
import type { IContainerBodySource } from '@cli/services/updater/interfaces/container-body-source.interface';
import type { IContainerInspect } from '@cli/services/updater/interfaces/container-inspect.interface';

/**
 * A service's declared configuration on the image it already runs.
 *
 * The edge is what visitors connect to, and it is deliberately not moved to each new version (every
 * move is a gap at the front door). So a release that changes its settings — a log driver, a memory
 * limit — gets them applied, while the version it runs stays the one the operator last deployed.
 */
export class PinnedImageBody implements IContainerBodySource {
  readonly origin: string;

  constructor(private readonly inner: IContainerBodySource, private readonly image: string) {
    this.origin = inner.origin;
  }

  async build(service: string, name: string, number: number, template: IContainerInspect): Promise<IContainerBody> {
    const built = await this.inner.build(service, name, number, template);
    return { ...built, body: { ...built.body, Image: this.image } };
  }
}
