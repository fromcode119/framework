import type { DeployCapacity } from '@fromcode119/core';
import type { ShippedMigration } from '@cli/services/deploy/shipped-migration';

/**
 * What a rolling swap and the choice of deploy mode need from a running stack.
 *
 * Two implementations, one behaviour: `ComposeStack` drives a box over ssh with the docker CLI (the
 * deploy command), `EngineStack` drives the box it runs on through the Docker Engine API (the updater
 * service, whose image ships no docker CLI). `RollingDeploy` and `DeployStrategy` are written against
 * this, so both ways of updating a deployment roll the same way — the updater used to stop each app
 * before starting its replacement, which is the gap rolling exists to avoid.
 */
export interface IDeployStack {
  /** Which of `services` this stack runs (or, for compose, declares). */
  declared(services: readonly string[]): Promise<string[]>;
  /** Running container ids of one service, oldest first. */
  containerIds(service: string): Promise<string[]>;
  /** Starts `service` when it is not running; one that is keeps running exactly as it is. */
  ensure(service: string): Promise<number>;
  /** Adds containers of `service`, on the version being deployed, beside the running ones. */
  scale(service: string, count: number): Promise<number>;
  /** Runs a node one-liner inside ONE container; the answer is its stdout ('' on failure). */
  probeContainer(id: string, script: string): Promise<string>;
  imageOf(id: string): Promise<string>;
  logsOf(id: string, lines?: number): Promise<string>;
  /** Processes in one container running as a plugin's OS user, or null when it cannot be told. */
  processesFromUid(id: string, uidBase: number): Promise<number | null>;
  /** SIGTERM, then up to `graceSeconds` for requests in flight, then gone. 0 on success. */
  stopAndRemove(id: string, graceSeconds: number): Promise<number>;
  /** Replaces `service` in place on the version being deployed — the one gap rolling cannot avoid. */
  restartService(service: string): Promise<number>;
  /** One read-only query against the platform database ('' when it cannot be asked). */
  query(sql: string): Promise<string>;
  /** The core migrations the api image of the version being deployed ships. */
  shippedMigrations(): Promise<ShippedMigration[]>;
  /** Whether the machine has the memory to run a second copy of the largest of `services`. */
  capacity(services: readonly string[]): Promise<DeployCapacity>;
}
