import type { ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/react-class-components';
import { FrameworkIcons } from '@fromcode119/react';
import { Card } from '@/components/ui/view/card.client';
import { Checkbox } from '@/components/ui/view/checkbox.client';
import { Dropdown } from '@/components/ui/view/dropdown.client';
import { HorizontalAlign } from '@/components/ui/enums/horizontal-align.enum';
import type { IDropdownItem } from '@/components/ui/interfaces/dropdown-item.interface';
import { AdminClass } from '@/lib/admin-class';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

/**
 * One thing shown by its picture: a file, a folder, anything chosen by eye rather than by name.
 *
 * The picture is the way in — pressing it opens the thing. Under it stand the name, one quiet line of
 * facts and the "more" menu; everything that can be done with the thing is in that menu, so nothing
 * appears only under a pointer and nothing is out of reach on a phone. A tick is drawn when the tile
 * can be chosen along with others.
 */
export class Tile extends PureReactor {
  @prop declare title: string;
  /** One quiet line under the name: a size, a kind, a count. */
  @prop declare facts?: string;
  /** The picture's address. Without one — or when it cannot be loaded — `icon` stands in its place. */
  @prop declare picture?: string;
  @prop declare icon?: ReactNode;
  /** Badges drawn on the picture: what the thing is marked as. */
  @prop declare marks?: ReactNode;
  @prop declare selected?: boolean;
  /** Given, the tile carries a tick. */
  @prop declare onSelect?: () => void;
  /** What can be done with the thing. */
  @prop declare menu?: IDropdownItem[];
  @prop declare onOpen: () => void;
  /** What pressing the picture does, for a reader who cannot see it. */
  @prop declare openLabel: string;
  @prop declare onPictureError?: () => void;

  render(): ReactNode {
    const tile = AdminClass.of('tile');
    return (
      <Card noPadding className={`${tile} ${AdminClass.SURFACE}${this.selected ? ` ${tile}--on` : ''}`}>
        <div className={`${tile}__picture`}>
          <button type="button" className={`${tile}__open`} onClick={this.onOpen} aria-label={this.openLabel} title={this.openLabel} />
          {this.onSelect ? <Checkbox checked={Boolean(this.selected)} onChange={this.onSelect} className={`${tile}__tick`} /> : null}
          {this.picture
            ? <img src={this.picture} alt="" onError={this.onPictureError} />
            : <span className={`${tile}__icon`}>{this.icon}</span>}
          {this.marks ? <span className={`${tile}__marks`}>{this.marks}</span> : null}
        </div>
        <div className={`${tile}__foot`}>
          <div className={`${tile}__text`}>
            <div className={`${tile}__name`} title={this.title}>{this.title}</div>
            {this.facts ? <div className={`${tile}__facts`}>{this.facts}</div> : null}
          </div>
          {this.menu?.length ? (
            <Dropdown align={HorizontalAlign.RIGHT} items={this.menu} trigger={
              <span className="fc-record-card__menu" aria-label={AdminI18n.t('common.more')}><FrameworkIcons.More size={15} /></span>
            } />
          ) : null}
        </div>
      </Card>
    );
  }
}
