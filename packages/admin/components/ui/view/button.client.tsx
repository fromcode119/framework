import { ButtonVariant } from '@/components/ui/enums/button-variant.enum';
import { FieldSize } from '@/components/ui/enums/field-size.enum';
import type { ButtonHTMLAttributes } from 'react';
import type { ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/reactor';

export class Button extends PureReactor {
  /** JSX props — the declared @prop fields, so call sites are type-checked without a <Props> generic. */
  declare props: Pick<Button, 'variant' | 'size' | 'children' | 'className' | 'isLoading' | 'icon' | 'as' | 'href' | 'target'>
    & Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children' | 'className'>;

  @prop declare variant?: ButtonVariant;
  @prop declare size?: FieldSize;
  @prop declare children: ReactNode;
  @prop declare className?: string;
  @prop declare isLoading?: boolean;
  @prop declare icon?: ReactNode;
  @prop declare as?: any;
  @prop declare href?: string;
  @prop declare target?: string;

  render(): ReactNode {
    const {
      variant: _variant,
      size: _size,
      children: _children,
      className: _className,
      isLoading: _isLoading,
      icon: _icon,
      as: _as,
      ...props
    } = this.props as Record<string, any>;
  const variant = this.variant ?? ButtonVariant.PRIMARY;
  const size = this.size ?? FieldSize.MD;
  const children = this.children;
  const className = this.className ?? '';
  const isLoading = this.isLoading;
  const icon = this.icon;
  const Component = this.as ?? 'button';
  // Solid variants carry elevation via `fc-elevated-control`, NOT a hardcoded `shadow-sm`: the token
  // behind it is what the Appearance → Surface shadows switch turns off. A literal utility here would
  // survive the switch and leave buttons the only elevated thing on a flat admin.
  const variants: Record<string, any> = {
    primary: 'bg-[var(--primary)] hover:brightness-95 text-[var(--primary-foreground)] fc-elevated-control',
    secondary: 'bg-[var(--secondary)] border border-[var(--border)] text-[var(--secondary-foreground)] fc-elevated-control hover:brightness-98',
    danger: 'bg-[var(--destructive)] hover:brightness-95 text-[var(--destructive-foreground)] fc-elevated-control',
    ghost: 'hover:bg-[var(--muted)] text-[var(--muted-foreground)] hover:text-[var(--foreground)]',
    outline: 'border border-[var(--border)] bg-transparent text-[var(--foreground)] hover:bg-[var(--muted)]',
  };

  const sizes: Record<string, string> = {
    sm: 'h-8 px-3 text-[10px]',
    md: 'h-10 px-4 text-[12px]',
    lg: 'h-11 px-6 text-[13px]',
    icon: 'h-10 w-10 p-0',
  };

  const spinnerColor = variant === ButtonVariant.PRIMARY || variant === ButtonVariant.DANGER
    ? 'border-white/20 border-t-white'
    : 'border-[color-mix(in_srgb,var(--primary)_20%,transparent)] border-t-[var(--primary)]';

  return (
    <Component
      className={`inline-flex items-center justify-center gap-2 rounded-[var(--radius)] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 ${variants[ButtonVariant.resolve(variant).value]} ${sizes[FieldSize.resolve(size).value]} ${className}`}
      {...props}
    >
      {isLoading ? (
        <div className={`h-4 w-4 border-2 rounded-full animate-spin ${spinnerColor}`} />
      ) : (
        <>
          {icon && <span className="flex-shrink-0">{icon}</span>}
          {children}
        </>
      )}
    </Component>
  );
  }
}
