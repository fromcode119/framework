import type { ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/react-class-components';
import { Button } from '@/components/ui/view/button.client';
import { ButtonVariant } from '@/components/ui/enums/button-variant.enum';
import { FieldSize } from '@/components/ui/enums/field-size.enum';
import { EmptyState } from '@/components/ui/view/empty-state.client';

/**
 * A plugin dashboard's empty block. It keeps its own props, because plugins call it by this name;
 * what it draws is the console's one empty state — it used to draw a dashed box of its own with an
 * indigo button painted into the markup.
 */
export class PluginEmptyState extends PureReactor {
  @prop declare icon?: ReactNode;
  @prop declare title: string;
  @prop declare description?: string;
  @prop declare action?: { label: string; onClick: () => void };

  render(): ReactNode {
    const action = this.action;
    return (
      <EmptyState
        icon={this.icon}
        title={this.title}
        hint={this.description}
        action={action ? (
          <Button variant={ButtonVariant.PRIMARY} size={FieldSize.SM} onClick={action.onClick}>{action.label}</Button>
        ) : null}
      />
    );
  }
}
