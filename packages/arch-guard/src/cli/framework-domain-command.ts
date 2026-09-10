import { FrameworkDomainGuard } from '../framework-domain-guard';
import { ArchorCommand } from './arch-guard-command';

/** `arch-guard framework-domain` — Keep business-domain logic (money, currency) out of the framework. */
export class FrameworkDomainCommand extends ArchorCommand {
  readonly summary = 'Keep business-domain logic out of the framework.';

  run(_argv: string[]): number {
    return FrameworkDomainGuard.run() ?? 0;
  }
}
