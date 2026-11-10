import type { IContainerInspect } from '@cli/services/updater/interfaces/container-inspect.interface';
import type { IContainerBody } from '@cli/services/updater/interfaces/container-body.interface';

/** Where a new container of a service gets its configuration from. */
export interface IContainerBodySource {
  /** Says in words where the configuration comes from, for the update's steps. */
  readonly origin: string;
  /** The create body for `name` (container number `number`) of `service`; `template` is a running container of it. */
  build(service: string, name: string, number: number, template: IContainerInspect): Promise<IContainerBody>;
}
