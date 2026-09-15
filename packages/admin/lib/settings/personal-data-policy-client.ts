import { AdminApi } from '@/lib/api';
import { AdminConstants } from '@/lib/constants/admin.constants';
import type { IPersonalDataPolicyChoice } from '@/app/settings/personal-data/interfaces/personal-data-policy-choice.interface';
import type { IPersonalDataChoiceMap } from '@/app/settings/personal-data/interfaces/personal-data-choice-map.interface';
import type { IPersonalDataPolicyDataset } from '@/app/settings/personal-data/interfaces/personal-data-policy-dataset.interface';

/**
 * Reading the erasure policy, and shaping what the page stores back.
 *
 * The RESOLVED answer is only ever read from the server, never recomputed here: the layering that
 * decides it is the same code the erasure itself runs, and a second implementation on the client
 * would be a screen that can disagree with what actually happens.
 */
export class PersonalDataPolicyClient {
  static async get(): Promise<any> {
    return AdminApi.get(AdminConstants.ENDPOINTS.SYSTEM.PERSONAL_DATA_POLICY);
  }

  static async platformKeys(): Promise<any> {
    return AdminApi.get(AdminConstants.ENDPOINTS.SYSTEM.SETTINGS_PLATFORM_KEYS);
  }

  /** The endpoint's rows, in the shape one screen row needs. */
  static toDatasets(response: any): IPersonalDataPolicyDataset[] {
    const rows = Array.isArray(response?.datasets) ? response.datasets : [];
    return rows.map((row: any) => ({
      id: String(row?.id ?? ''),
      label: String(row?.label ?? ''),
      fields: Array.isArray(row?.fields) ? row.fields.map((field: any) => String(field)) : [],
      strategies: Array.isArray(row?.strategies) ? row.strategies.map((s: any) => String(s)) : [],
      strategy: String(row?.strategy ?? ''),
      reason: String(row?.reason ?? ''),
      provenance: String(row?.provenance ?? ''),
      // Phrased "the default declared by X", never "X default": the framework's own datasets are
      // addressed as `platform`, and "platform default — anonymise" sitting under a column headed
      // "Platform default" reads as the platform LAYER rather than as the declaring owner.
      declaredProvenance: `the default declared by ${String(row?.pluginSlug ?? '')} — ${String(row?.defaultStrategy ?? '')}`,
      problem: String(row?.problem ?? ''),
    }));
  }

  /** A stored blob is JSON text or an already-parsed object, depending on the settings response. */
  static toChoiceMap(value: unknown): IPersonalDataChoiceMap {
    const source = typeof value === 'string' ? PersonalDataPolicyClient.parse(value) : value;
    if (!source || typeof source !== 'object' || Array.isArray(source)) return {};
    const map: IPersonalDataChoiceMap = {};
    for (const [id, entry] of Object.entries(source as Record<string, any>)) {
      const strategy = String(entry?.strategy ?? '').trim();
      if (strategy) map[id] = { strategy, reason: String(entry?.reason ?? '') };
    }
    return map;
  }

  /**
   * Set or clear one dataset's choice.
   *
   * Clearing REMOVES the key rather than writing an empty strategy: "inherit the layer below" is the
   * absence of a choice, and a row saying `{strategy: ''}` would be a stored decision that means
   * nothing — the exact shape of value this codebase refuses to keep.
   */
  static withChoice(current: IPersonalDataChoiceMap, id: string, choice: IPersonalDataPolicyChoice | undefined): IPersonalDataChoiceMap {
    const next = { ...current };
    if (choice?.strategy) next[id] = choice;
    else delete next[id];
    return next;
  }

  private static parse(text: string): unknown {
    try {
      return JSON.parse(text);
    } catch {
      return null;
    }
  }
}
