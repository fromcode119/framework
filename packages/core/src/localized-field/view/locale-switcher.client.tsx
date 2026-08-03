import type { CSSProperties, MouseEvent as ReactMouseEvent, ReactNode } from 'react';
import { Reactor, prop, state, bound, ref, Ref } from '@fromcode119/reactor';
import { GlobeIcon } from '@core/localized-field/view/globe-icon.client';
import { ChevronIcon } from '@core/localized-field/view/chevron-icon.client';

/**
 * The locale chip + dropdown. Closes on an outside click.
 *
 * The style objects are `private static readonly` members rather than module constants (house rule:
 * nothing lives outside the class). They are inline rather than a stylesheet because this component
 * reaches PLUGIN bundles through the runtime bridge, where no stylesheet of core's is guaranteed to
 * be loaded — see the note on {@link LocalizedField}.
 */
export class LocaleSwitcher extends Reactor {
  @prop declare registry: ReadonlyArray<{ code: string; label: string }>;
  @prop declare active: string;
  @prop declare onChange: (next: string) => void;

  @state open = false;

  @ref private declare wrapperRef: Ref<HTMLDivElement>;

  private static readonly CHIP_STYLE: CSSProperties = {
    display: 'inline-flex', alignItems: 'center', gap: 4,
    height: 22, padding: '0 6px', borderRadius: 6,
    background: '#fff', border: '1px solid #e2e8f0', color: '#475569',
    fontSize: 10, fontWeight: 700, letterSpacing: '0.04em', fontFamily: 'inherit',
    cursor: 'pointer', outline: 'none', whiteSpace: 'nowrap',
    boxShadow: '0 1px 1px rgba(15,23,42,0.04)',
  };

  private static readonly MENU_STYLE: CSSProperties = {
    position: 'absolute', top: 'calc(100% + 4px)', right: 0, zIndex: 20,
    minWidth: 200, padding: 6,
    background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10,
    boxShadow: '0 12px 32px rgba(15,23,42,0.16)',
    display: 'flex', flexDirection: 'column', gap: 2,
  };

  private static readonly WRAPPER_STYLE: CSSProperties = { position: 'relative', display: 'inline-block' };

  private static readonly LABEL_STYLE: CSSProperties = {
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
  };

  private static menuItemStyle(active: boolean): CSSProperties {
    return {
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      width: '100%', padding: '7px 9px', borderRadius: 6,
      background: active ? '#4f46e5' : 'transparent',
      color: active ? '#fff' : '#334155',
      fontSize: 11, fontWeight: 600, fontFamily: 'inherit',
      border: 'none', cursor: 'pointer', textAlign: 'left',
    };
  }

  private static codeStyle(active: boolean): CSSProperties {
    return { marginLeft: 8, opacity: active ? 0.95 : 0.6, fontSize: 10 };
  }

  componentDidMount(): void {
    this.listen(document, 'mousedown', this.onDocumentMouseDown);
  }

  @bound
  protected onDocumentMouseDown(event: Event): void {
    if (!this.open) return;
    const wrapper = this.wrapperRef.current;
    if (!wrapper) return;
    if (!wrapper.contains(event.target as Node)) this.open = false;
  }

  @bound
  protected onToggle(): void {
    this.open = !this.open;
  }

  @bound
  protected onItemClick(event: ReactMouseEvent<HTMLButtonElement>): void {
    this.onChange(event.currentTarget.dataset.code ?? '');
    this.open = false;
  }

  private get activeCode(): string {
    return (this.active || 'en').toUpperCase();
  }

  render(): ReactNode {
    return (
      <div ref={this.wrapperRef} style={LocaleSwitcher.WRAPPER_STYLE}>
        <button type="button" onClick={this.onToggle} style={LocaleSwitcher.CHIP_STYLE} title="Switch locale">
          <GlobeIcon size={11} />
          <span>{this.activeCode}</span>
          <ChevronIcon open={this.open} />
        </button>
        {this.open ? (
          <div style={LocaleSwitcher.MENU_STYLE} role="menu">
            {this.registry.map((locale) => {
              const isActive = locale.code === this.active;
              return (
                <button key={locale.code} type="button" role="menuitem"
                  data-code={locale.code}
                  onClick={this.onItemClick}
                  style={LocaleSwitcher.menuItemStyle(isActive)}>
                  <span style={LocaleSwitcher.LABEL_STYLE}>{locale.label}</span>
                  <span style={LocaleSwitcher.codeStyle(isActive)}>{locale.code.toUpperCase()}</span>
                </button>
              );
            })}
          </div>
        ) : null}
      </div>
    );
  }
}
