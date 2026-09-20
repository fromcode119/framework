import { DomainTransportFallbackGuard } from '../domain-transport-fallback-guard';
import { ArchorCommand } from './arch-guard-command';

/** `arch-guard domain-transport-fallback` — a domain method must not fall back to a raw route. */
export class DomainTransportFallbackCommand extends ArchorCommand {
  readonly summary = 'A domain method falling back to a hardcoded HTTP route.';

  run(_argv: string[]): number {
    return DomainTransportFallbackGuard.run();
  }
}
