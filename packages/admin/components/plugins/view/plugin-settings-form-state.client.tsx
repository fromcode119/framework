import { NotificationType } from '@/components/enums/notification-type.enum';
import { prop, state, ref, watch } from '@fromcode119/react-class-components';
import type { Ref } from '@fromcode119/react-class-components';
import { AdminComponent } from '@/components/view/admin-component.client';

/**
 * What the plugin settings form knows: the schema it was given, the values over it, and whether any
 * of them have been touched.
 *
 * The base of this form's chain — the load and the writes, then the lifecycle and the markup.
 *
 * A saved SECRET is never sent back to the browser, so `savedSecretFields` is what the form reads to
 * know one exists: an empty password box means "unchanged", not "cleared".
 */
export abstract class PluginSettingsFormState extends AdminComponent {
  @prop declare pluginSlug: string;
  @prop declare formId?: string;
  @prop declare onStateChange?: (isDirty: boolean, saving: boolean) => void;

  @ref declare protected importInputRef: Ref<HTMLInputElement>;

  @state loading = true;
  @state saving = false;
  @state schema: any = null;
  @state settings: Record<string, any> = {};
  @state savedSecretFields: Set<string> = new Set();
  @state errors: Record<string, string | string[]> = {};
  @state activeTab = '';
  @state isDirty = false;
  @state status: { type: NotificationType; message: string } | null = null;

  protected statusTimer?: ReturnType<typeof setTimeout>;

  protected get triggerRefresh(): () => void {
    return this.runtime.plugins.triggerRefresh;
  }

  @watch('status')
  onStatusChange(): void {
    if (this.statusTimer) clearTimeout(this.statusTimer);
    if (this.status) {
      this.statusTimer = setTimeout(() => {
        this.status = null;
      }, 5000);
    }
  }

  @watch('isDirty', 'saving')
  notifyStateChange(): void {
    this.onStateChange?.(this.isDirty, this.saving);
  }

  protected get visibleFields(): any[] {
    const schema = this.schema;
    if (!schema.tabs || schema.tabs.length === 0) {
      return schema.fields;
    }

    const currentTab = schema.tabs.find((t: any) => t.id === this.activeTab);
    if (!currentTab) return schema.fields;

    return schema.fields.filter((f: any) => {
      // Check if field specifically belongs to this tab
      if (f.tab === this.activeTab) return true;

      // Check if tab definition explicitly lists this field
      if (currentTab.fields && Array.isArray(currentTab.fields)) {
        return currentTab.fields.includes(f.name);
      }

      return false;
    });
  }
}
