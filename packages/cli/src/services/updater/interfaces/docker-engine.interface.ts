import type { IContainerSummary } from '@cli/services/updater/interfaces/container-summary.interface';
import type { IContainerInspect } from '@cli/services/updater/interfaces/container-inspect.interface';
import type { IImageDefaults } from '@cli/services/updater/interfaces/image-defaults.interface';

/**
 * The slice of the Docker Engine API the updater uses.
 *
 * An interface so the update logic can be proven against an in-memory engine — including the failures
 * (a pull that does not finish, a container that will not start) a real daemon rarely produces on demand.
 */
export interface IDockerEngine {
  listContainers(labels: string[]): Promise<IContainerSummary[]>;
  inspect(id: string): Promise<IContainerInspect>;
  imageDefaults(reference: string): Promise<IImageDefaults>;
  /** Whether `repository:tag` is already on this machine. */
  hasImage(reference: string): Promise<boolean>;
  /** Pulls `repository:tag`; resolves to an error message, or `null` when the image is now local. */
  pull(repository: string, tag: string): Promise<string | null>;
  createContainer(name: string, body: Record<string, any>): Promise<string>;
  connectNetwork(network: string, containerId: string, endpoint: Record<string, any>): Promise<void>;
  start(id: string): Promise<void>;
  stop(id: string, timeoutSeconds: number): Promise<void>;
  rename(id: string, name: string): Promise<void>;
  remove(id: string): Promise<void>;
  /** Every local image as `repository:tag`. */
  listImages(): Promise<string[]>;
  removeImage(reference: string): Promise<void>;
}
