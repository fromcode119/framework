import { MeasurementWeightUnit } from '@core/enums/measurement-weight-unit.enum';
import { MeasurementLengthUnit } from '@core/enums/measurement-length-unit.enum';
import { MeasurementSystem } from '@core/enums/measurement-system.enum';
/**
 * Universal measurement-system knowledge owned by the framework (like ISO country codes) — NOT a
 * business-domain concern. The platform `measurement_system` setting (admin Settings → Localization,
 * default metric) decides whether physical quantities are shown/entered in metric (cm/kg) or imperial
 * (in/lb). Plugins ask this util for the resolved system, the unit labels, and the canonical-unit
 * conversions instead of hardcoding `=== 'imperial' ? 'in' : 'cm'` or the lb→kg factor themselves.
 */
export class MeasurementSystemUtils {
  static readonly METRIC = 'metric';
  static readonly IMPERIAL = 'imperial';
  /** The framework system-setting key (read off the field renderer's `globalSettings`). */
  static readonly SETTING_KEY = 'measurement_system';

  private static readonly POUNDS_TO_KILOGRAMS = 0.45359237;
  private static readonly INCHES_TO_CENTIMETERS = 2.54;

  /** Coerce any value to a valid system, DEFAULTING TO METRIC (kg/cm). */
  static normalize(value: unknown): MeasurementSystem {
    return String(value ?? '').trim().toLowerCase() === MeasurementSystemUtils.IMPERIAL
      ? MeasurementSystem.IMPERIAL
      : MeasurementSystem.METRIC;
  }

  /**
   * Resolve the platform measurement system from the framework `globalSettings`. Returns metric/imperial
   * when explicitly configured; otherwise `fallback` (itself defaulting to metric) — so a deployment that
   * never set the option, and a record with no prior unit, both land on metric.
   */
  static resolve(globalSettings?: Record<string, unknown> | null, fallback?: unknown): MeasurementSystem {
    const raw = String(globalSettings?.[MeasurementSystemUtils.SETTING_KEY] ?? '').trim().toLowerCase();
    if (raw === MeasurementSystemUtils.IMPERIAL) return MeasurementSystem.IMPERIAL;
    if (raw === MeasurementSystemUtils.METRIC) return MeasurementSystem.METRIC;
    return MeasurementSystemUtils.normalize(fallback);
  }

  /** Length unit label for a system: imperial → `in`, metric → `cm`. */
  static lengthUnit(system: unknown): MeasurementLengthUnit {
    return MeasurementSystemUtils.normalize(system) === MeasurementSystem.IMPERIAL ? MeasurementLengthUnit.IN : MeasurementLengthUnit.CM;
  }

  /** Weight unit label for a system: imperial → `lb`, metric → `kg`. */
  static weightUnit(system: unknown): MeasurementWeightUnit {
    return MeasurementSystemUtils.normalize(system) === MeasurementSystem.IMPERIAL ? MeasurementWeightUnit.LB : MeasurementWeightUnit.KG;
  }

  /** Convert a weight expressed in the system's unit to canonical KILOGRAMS (couriers always use kg). */
  static toKilograms(weight: number, system: unknown): number {
    const value = Number(weight) || 0;
    return MeasurementSystemUtils.normalize(system) === MeasurementSystem.IMPERIAL
      ? Number((value * MeasurementSystemUtils.POUNDS_TO_KILOGRAMS).toFixed(3))
      : value;
  }

  /** Convert a length expressed in the system's unit to canonical CENTIMETERS. */
  static toCentimeters(length: number, system: unknown): number {
    const value = Number(length) || 0;
    return MeasurementSystemUtils.normalize(system) === MeasurementSystem.IMPERIAL
      ? Number((value * MeasurementSystemUtils.INCHES_TO_CENTIMETERS).toFixed(3))
      : value;
  }
}
