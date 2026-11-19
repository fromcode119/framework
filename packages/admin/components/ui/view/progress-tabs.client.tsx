import type { ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/react-class-components';
import { FrameworkIcons } from '@fromcode119/react';
import { AdminClass } from '@/lib/admin-class';

/**
 * The steps of something made in order — "Details, Organize, Variants" — across the head of the
 * window that makes it. Each step says where it stands: not started, in progress, or done. A step
 * can be opened by name once it is reachable; the caller decides that with `disabled`.
 *
 * `Tabs` chooses between views of one thing. This is a path through several.
 */
export class ProgressTabs extends PureReactor {
  /** `title` names a step whose label is not plain text: on a phone a step that is not open shows its mark alone. */
  @prop declare steps: Array<{ id: string; label: ReactNode; title?: string; status?: 'not-started' | 'in-progress' | 'completed'; disabled?: boolean }>;
  @prop declare value: string;
  @prop declare onChange: (id: string) => void;
  @prop declare className?: string;
  @prop declare label?: string;

  private mark(status: string | undefined): ReactNode {
    const name = AdminClass.of('progress-tabs');
    if (status === 'completed') return <FrameworkIcons.Check size={12} strokeWidth={2.5} />;
    return <span className={`${name}__ring`} data-status={status || 'not-started'} />;
  }

  render(): ReactNode {
    const name = AdminClass.of('progress-tabs');
    return (
      <div className={`${name} ${this.className ?? ''}`} role="tablist" aria-label={this.label}>
        {this.steps.map((step) => {
          const on = step.id === this.value;
          return (
            <button
              key={step.id}
              type="button"
              role="tab"
              aria-selected={on}
              disabled={step.disabled}
              title={step.title ?? (typeof step.label === 'string' ? step.label : undefined)}
              className={`${name}__step`}
              data-status={step.status || 'not-started'}
              onClick={() => this.onChange(step.id)}
            >
              <span className={`${name}__mark`}>{this.mark(step.status)}</span>
              <span className={`${name}__label`}>{step.label}</span>
            </button>
          );
        })}
      </div>
    );
  }
}
