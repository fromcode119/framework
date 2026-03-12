import { CoercionUtils } from '@fromcode119/core/client';

export class PluginConditionUtils {
  static matchesCondition(actualValue: unknown, expectedValue: unknown): boolean {
    if (typeof expectedValue === 'boolean') {
      const actualBool = CoercionUtils.toBoolean(actualValue, undefined);
      return actualBool === undefined ? false : actualBool === expectedValue;
    }
    if (typeof expectedValue === 'number') {
      const actualNumber = CoercionUtils.toNumber(actualValue, NaN);
      return Number.isFinite(actualNumber) && actualNumber === expectedValue;
    }
    if (typeof expectedValue === 'string') {
      return CoercionUtils.toString(actualValue).toLowerCase() === expectedValue.trim().toLowerCase();
    }
    return actualValue === expectedValue;
  }
}
