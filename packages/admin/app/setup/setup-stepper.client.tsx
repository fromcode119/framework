import type { ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/react-class-components';
import { SetupStep } from '@/app/setup/enums/setup-step.enum';
import { AdminDictionary } from '@/lib/i18n/admin-dictionary';

/** Which of the three steps you are on, named rather than counted. */
export class SetupStepper extends PureReactor {
  @prop declare locale: string;
  @prop declare current: SetupStep;

  private labelClass(step: SetupStep): string {
    if (step.index === this.current.index) return 'fc-tone-brand';
    return step.index < this.current.index ? 'fc-tone-muted' : 'fc-tone-faint';
  }

  private barClass(step: SetupStep): string {
    return step.index <= this.current.index ? 'fc-tone-brand-solid' : 'fc-tone-faint-solid opacity-40';
  }

  render(): ReactNode {
    return (
      <div className="flex items-stretch gap-2 mb-6">
        {SetupStep.ordered.map((step) => (
          <div key={step.value} className="flex-1 space-y-2">
            <div className={`h-[3px] rounded-full transition-colors ${this.barClass(step)}`} />
            <span className={`block fc-size-xs font-medium ${this.labelClass(step)}`}>
              {AdminDictionary.translate(this.locale, `setup.steps.${step.value}`)}
            </span>
          </div>
        ))}
      </div>
    );
  }
}
