import type { ChangeEvent, KeyboardEvent, ReactNode } from 'react';
import { FrameworkIcons } from '@fromcode119/react';
import { Reactor, bound, prop, ref } from '@fromcode119/react-class-components';
import type { Ref } from '@fromcode119/react-class-components';
import { Input } from '@/components/ui/view/input.client';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

/**
 * The menu's own search: what is typed narrows the menu in place to the pages whose names match, so any
 * page of any section is one word away. ⌘K (Ctrl+K) puts the cursor here from anywhere in the console;
 * Escape clears it and gives the full menu back.
 */
export class SidebarSearch extends Reactor {
  @prop declare query: string;
  @prop declare onQuery: (query: string) => void;
  @ref declare private input: Ref<Input>;

  componentDidMount(): void {
    window.addEventListener('keydown', this.shortcut);
  }

  componentWillUnmount(): void {
    window.removeEventListener('keydown', this.shortcut);
  }

  @bound private shortcut(event: globalThis.KeyboardEvent): void {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      this.input.current?.focus();
    }
  }

  @bound private change(event: ChangeEvent<HTMLInputElement>): void {
    this.onQuery(event.target.value);
  }

  @bound private key(event: KeyboardEvent<HTMLInputElement>): void {
    if (event.key === 'Escape') this.onQuery('');
  }

  render(): ReactNode {
    const label = AdminI18n.t('shell.nav.search');
    return (
      <div className="fc-nav-search">
        <FrameworkIcons.Search size={15} className="fc-nav-search__icon" />
        <Input ref={this.input} type="search" value={this.query} onChange={this.change} onKeyDown={this.key}
          placeholder={label} aria-label={label} inputClassName="fc-nav-search__field" />
        {this.query ? null : <kbd className="fc-nav-search__kbd">{AdminI18n.t('shell.nav.searchShortcut')}</kbd>}
      </div>
    );
  }
}
