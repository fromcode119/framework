import type { KitDoc } from '@/app/kit/kit-doc';
import { ButtonKit } from '@/app/kit/docs/button.kit';
import { InputKit } from '@/app/kit/docs/input.kit';
import { TextAreaKit } from '@/app/kit/docs/text-area.kit';
import { SelectKit } from '@/app/kit/docs/select.kit';
import { CheckboxKit } from '@/app/kit/docs/checkbox.kit';
import { SwitchKit } from '@/app/kit/docs/switch.kit';
import { RadioGroupKit } from '@/app/kit/docs/radio-group.kit';
import { SearchFieldKit } from '@/app/kit/docs/search-field.kit';
import { FieldsMoreKit } from '@/app/kit/docs/fields-more.kit';
import { BadgeKit } from '@/app/kit/docs/badge.kit';
import { AlertKit } from '@/app/kit/docs/alert.kit';
import { TooltipKit } from '@/app/kit/docs/tooltip.kit';
import { AvatarKit } from '@/app/kit/docs/avatar.kit';
import { SmallKit } from '@/app/kit/docs/small.kit';
import { TabsKit } from '@/app/kit/docs/tabs.kit';
import { SurfacesKit } from '@/app/kit/docs/surfaces.kit';
import { OverlaysKit } from '@/app/kit/docs/overlays.kit';
import { FieldsRichKit } from '@/app/kit/docs/fields-rich.kit';
import { ShellKit } from '@/app/kit/docs/shell.kit';
import { PanelsKit } from '@/app/kit/docs/panels.kit';
import { NewPiecesKit } from '@/app/kit/docs/new-pieces.kit';
import { MotionKit } from '@/app/kit/docs/motion.kit';
import { PageHeaderKit } from '@/app/kit/docs/page-header.kit';
import { PagePiecesKit } from '@/app/kit/docs/page-pieces.kit';
import { RecordPiecesKit } from '@/app/kit/docs/record-pieces.kit';
import { PartsLineKit } from '@/app/kit/docs/parts-line.kit';
import { RecordSummaryRowKit } from '@/app/kit/docs/record-summary-row.kit';
import { QrCodeKit } from '@/app/kit/docs/qr-code.kit';
import { ScanKit } from '@/app/kit/docs/scan.kit';
import { LabelSheetKit } from '@/app/kit/docs/label-sheet.kit';

/** Every component's page in the kit, and the order the groups stand in. */
export class KitCatalog {
  private static readonly GROUPS = ['Actions', 'Forms', 'Data', 'Feedback', 'Navigation', 'Layout', 'Overlays', 'Typography', 'Foundations'];
  private static cache: KitDoc[] | null = null;

  static all(): KitDoc[] {
    if (!KitCatalog.cache) {
      KitCatalog.cache = [
        ButtonKit.doc(),
        InputKit.doc(), TextAreaKit.doc(), SelectKit.doc(), CheckboxKit.doc(), SwitchKit.doc(), RadioGroupKit.doc(), SearchFieldKit.doc(), ...FieldsMoreKit.docs(),
        BadgeKit.doc(), AlertKit.doc(), TooltipKit.doc(), AvatarKit.doc(), ...SmallKit.docs(), PartsLineKit.doc(), RecordSummaryRowKit.doc(), QrCodeKit.doc(), ScanKit.doc(), LabelSheetKit.doc(),
        ...TabsKit.docs(), ...SurfacesKit.docs(), PageHeaderKit.doc(), PagePiecesKit.doc(), ...RecordPiecesKit.docs(), ...OverlaysKit.docs(),
        ...FieldsRichKit.docs(), ...ShellKit.docs(), ...PanelsKit.docs(), ...NewPiecesKit.docs(), MotionKit.doc(),
      ];
    }
    return KitCatalog.cache;
  }

  static find(slug: string): KitDoc | null {
    return KitCatalog.all().find((doc) => doc.slug === slug) ?? null;
  }

  static groups(): Array<{ name: string; docs: KitDoc[] }> {
    return KitCatalog.GROUPS
      .map((name) => ({ name, docs: KitCatalog.all().filter((doc) => doc.group === name).sort((a, b) => a.name.localeCompare(b.name)) }))
      .filter((group) => group.docs.length);
  }
}
