import type { ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/reactor';

export class PageHeading extends PureReactor {
  @prop declare title: ReactNode;
  @prop declare subtitle?: ReactNode;
  @prop declare icon?: ReactNode;
  @prop declare badge?: ReactNode;

  get className(): string {
    return (this.props as { className?: string }).className ?? '';
  }

  get titleClassName(): string {
    return (this.props as { titleClassName?: string }).titleClassName
      ?? 'text-xl font-bold text-slate-900 dark:text-white tracking-tight leading-tight';
  }

  get subtitleClassName(): string {
    return (this.props as { subtitleClassName?: string }).subtitleClassName
      ?? 'text-xs font-medium text-slate-500 dark:text-slate-500 tracking-tight mt-0.5';
  }

  render(): ReactNode {
    return (
      <div className={this.className}>
        <div className="flex flex-wrap items-center gap-3">
          {this.icon}
          <h1 className={`min-w-0 ${this.titleClassName}`}>{this.title}</h1>
          {this.badge}
        </div>
        {this.subtitle ? <p className={this.subtitleClassName}>{this.subtitle}</p> : null}
      </div>
    );
  }
}
