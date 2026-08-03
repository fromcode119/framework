import type { ComponentType, ReactNode } from 'react';
import { Reactor } from '@fromcode119/reactor';
import { SlotsContext } from '@react/context/slots-context';
import type { ISlotComponent } from '@react/interfaces/slot-component.interface';
import type { ISlotProps } from '@react/interfaces/slot-props.interface';

export class Slot extends Reactor {
  declare props: Pick<ISlotProps, keyof ISlotProps>;
  render(): ReactNode {
    return (
      <SlotsContext.Context.Consumer>
        {(slots) => {
          const components = slots[this.props.name] || [];
          if (components.length === 0) return <>{this.props.fallback}</>;
          return <>{components.map((item, index) => this.renderSlotComponent(item, index))}</>;
        }}
      </SlotsContext.Context.Consumer>
    );
  }

  private renderSlotComponent(item: ISlotComponent, index: number): ReactNode {
    if (!item?.component) {
      console.warn(`[Slot] Requested component for slot "${this.props.name}" is undefined. Plugin: ${item?.pluginSlug || 'unknown'}`);
      return null;
    }

    if (!Slot.isValidComponent(item.component)) {
      console.warn(`[Slot] Component for slot "${this.props.name}" is of invalid type: ${typeof item.component}. Skipping.`);
      return null;
    }

    try {
      const componentName = (item.component as any)?.displayName || (item.component as any)?.name || `c${index}`;
      const Component = item.component as ComponentType<any>;
      return <Component {...this.props.props} key={`${item.pluginSlug}-${componentName}-${index}`} />;
    } catch (error) {
      console.error(`[Slot] Runtime error in slot component "${this.props.name}":`, error);
      return null;
    }
  }

  private static isValidComponent(component: any): boolean {
    return typeof component === 'function' || typeof component === 'string' || Boolean(component?.$$typeof);
  }
}
