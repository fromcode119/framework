import { Enum } from '@fromcode119/react-class-components';

/** The first-run wizard's steps, in the order they are shown. */
export class SetupStep extends Enum {
  static readonly LANGUAGE = new SetupStep('language', 0);
  static readonly ACCOUNT = new SetupStep('account', 1);
  static readonly PLATFORM = new SetupStep('platform', 2);

  private constructor(value: string, readonly index: number) {
    super(value);
  }

  static get ordered(): SetupStep[] {
    return [SetupStep.LANGUAGE, SetupStep.ACCOUNT, SetupStep.PLATFORM];
  }

  get isFirst(): boolean {
    return this.index === 0;
  }

  get isLast(): boolean {
    return this.index === SetupStep.ordered.length - 1;
  }

  /** Clamped at both ends, so neither button can walk off the wizard. */
  next(): SetupStep {
    return SetupStep.ordered[Math.min(this.index + 1, SetupStep.ordered.length - 1)];
  }

  previous(): SetupStep {
    return SetupStep.ordered[Math.max(this.index - 1, 0)];
  }
}
