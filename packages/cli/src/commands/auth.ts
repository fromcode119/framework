import { Command } from 'commander';
import { AuthRecoveryCommandService } from '@cli/services/auth-recovery-command-service';

export class AuthCommands {
  static registerAuthCommands(program: Command): void {
    AuthRecoveryCommandService.register(program);
  }
}
