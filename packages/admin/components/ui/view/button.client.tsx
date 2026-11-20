import { ButtonVariant } from '@/components/ui/enums/button-variant.enum';
import { FieldSize } from '@/components/ui/enums/field-size.enum';
import { AdminLink } from '@/components/view/admin-link.client';
import type { ButtonHTMLAttributes } from 'react';
import type { ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/react-class-components';

export class Button extends PureReactor {
  /** JSX props — the declared @prop fields, so call sites are type-checked without a <Props> generic. */
  declare props: Pick<Button, 'variant' | 'size' | 'children' | 'className' | 'isLoading' | 'icon' | 'as' | 'href' | 'target' | 'block'>
    & Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children' | 'className'>;

  @prop declare variant?: ButtonVariant;
  @prop declare size?: FieldSize;
  /**
   * OPTIONAL: an icon-only button is a designed use of this component, not an oversight — `sizes`
   * below carries an `icon` entry (`h-10 w-10 p-0`) that exists for exactly that shape. Requiring
   * children contradicted it, and cost nine plugin UIs a compile error each for a button the
   * framework's own styling supports.
   */
  @prop declare children?: ReactNode;
  @prop declare className?: string;
  @prop declare isLoading?: boolean;
  @prop declare icon?: ReactNode;
  @prop declare as?: any;
  @prop declare href?: string;
  @prop declare target?: string;
  /** As wide as its container — the one way to widen a button, since the button's own width outranks a utility class. */
  @prop declare block?: boolean;

  render(): ReactNode {
    const {
      variant: _variant,
      size: _size,
      children: _children,
      className: _className,
      isLoading: _isLoading,
      icon: _icon,
      as: _as,
      block: _block,
      ...props
    } = this.props as Record<string, any>;
  const variant = ButtonVariant.resolve(this.variant ?? ButtonVariant.PRIMARY);
  const size = this.size ?? FieldSize.MD;
  const children = this.children;
  const className = this.className ?? '';
  const isLoading = this.isLoading;
  const icon = this.icon;
  // An `href` has to change the ELEMENT, not just ride along as an attribute. A <button href="…"> is
  // inert — HTML buttons have no href — so three admin buttons (Sites → New site, Sites → Import, and
  // "Open the site" after an import) rendered correctly and did nothing when clicked. Only the one
  // call site that also passed `as={AdminLink}` worked, which is what made the prop look supported.
  // `as="a"` with an href is the same link: a raw <a> would skip the console mount and send a mounted
  // console's click to the storefront, so it renders through AdminLink like a bare href does.
  const Component = this.href && (!this.as || this.as === 'a') ? AdminLink : (this.as ?? 'button');
  // Every variant is a CLASS now, matching the record pages this console follows: 28px tall, 13/20,
  // the 1px edge carried by the shadow so a button sits on the page. The utilities that stood here
  // used `rounded-[var(--radius)]`, and --radius is the SITE's brand radius — BrandTokenStyleService
  // replaces it at runtime, so the console's own buttons changed corner with whichever site was open.
  const variants: Record<string, string> = {
    primary: 'fc-btn--primary',
    secondary: '',
    danger: 'fc-btn--danger',
    ghost: 'fc-btn--ghost',
    outline: '',
  };

  // One height for a button, the control height — not four. The `size` keys stay so no caller has to
  // change; `icon` is the square shape, which the stylesheet draws without an edge until it is raised.
  const sizes: Record<string, string> = {
    sm: '',
    md: '',
    lg: 'px-3',
    icon: 'fc-btn--icon',
  };


  return (
    <Component
      className={`fc-btn focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 ${variants[variant.value]} ${sizes[FieldSize.resolve(size).value]}${this.block ? ' fc-btn--block' : ''} ${className}`}
      {...props}
      // A button that is carrying something out takes no second press: a save pressed twice saved twice.
      disabled={Boolean((props as any).disabled) || Boolean(isLoading)}
      aria-busy={isLoading || undefined}
    >
      {/* While it works the spinner takes the icon's place and the words stay, so the button keeps its
          width and still says what it is doing. It used to be replaced by the spinner alone and shrank to
          a square. */}
      {isLoading
        ? <span className="fc-spinner fc-btn__spinner" aria-hidden="true" />
        : icon ? <span className="flex-shrink-0">{icon}</span> : null}
      {children}
    </Component>
  );
  }
}
