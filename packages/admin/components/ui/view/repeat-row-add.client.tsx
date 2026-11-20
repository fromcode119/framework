import type { ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/react-class-components';
import { FrameworkIcons } from '@fromcode119/react';
import { Button } from '@/components/ui/view/button.client';
import { ButtonVariant } from '@/components/ui/enums/button-variant.enum';
import { FieldSize } from '@/components/ui/enums/field-size.enum';

/**
 * The one way rows are added to a repeating field: a short "Add" placed on the field's own title line,
 * at its end, with the rows below — so the title says WHAT is added and the button need not repeat it.
 * Outside a field (no title line to sit on) it stays where it is put. Goes inside the `.fc-repeat`.
 */
export class RepeatRowAdd extends PureReactor {
  @prop declare label: string;
  @prop declare onAdd: () => void;
  @prop declare disabled?: boolean;

  render(): ReactNode {
    return (
      <Button type="button" className="fc-repeat__add" variant={ButtonVariant.SECONDARY} size={FieldSize.SM}
        disabled={this.disabled} onClick={this.onAdd} icon={<FrameworkIcons.Plus size={13} />}>
        {this.label}
      </Button>
    );
  }
}
