import { BaseService } from './base-service';

/**
 * Service for validation and evaluation logic.
 * 
 * Handles:
 * - Field visibility conditions
 * - Email validation
 * - URL validation
 * - Generic value checks
 */
export class ValidationService extends BaseService {
  /**
   * Evaluates field visibility conditions from plugin schemas.
   * 
   * Supports:
   * - Function conditions: (data, siblingData) => boolean
   * - Object conditions: { field, operator, value }
   * 
   * @example
   * evaluateCondition({ field: 'type', operator: 'equals', value: 'premium' }, { type: 'premium' })
   * // true
   * 
   * evaluateCondition((data) => data.active, { active: true })
   * // true
   */
  evaluateCondition(condition: any, data: any, fieldName?: string): boolean {
    if (!condition) return true;

    // Pattern: (data, siblingData) => boolean
    if (typeof condition === 'function') {
      try {
        return !!condition(data, data);
      } catch (e) {
        console.warn(`Condition function failed for ${fieldName || 'field'}:`, e);
        return true;
      }
    }

    // Handle object conditions: { field, operator, value }
    if (typeof condition !== 'object' || Array.isArray(condition)) {
      return true;
    }

    const { field: targetPath, operator, value } = condition;
    const actualValue = this.getNestedValue(data, targetPath);

    switch (operator) {
      case 'equals':
        return actualValue === value;
      case 'notEquals':
        return actualValue !== value;
      case 'contains': {
        if (Array.isArray(actualValue)) return actualValue.includes(value);
        return String(actualValue || '').includes(String(value));
      }
      case 'notContains': {
        if (Array.isArray(actualValue)) return !actualValue.includes(value);
        return !String(actualValue || '').includes(String(value));
      }
      case 'greaterThan':
        return Number(actualValue) > Number(value);
      case 'lessThan':
        return Number(actualValue) < Number(value);
      case 'exists':
        return actualValue !== undefined && actualValue !== null && actualValue !== '';
      case 'notExists':
        return actualValue === undefined || actualValue === null || actualValue === '';
      default:
        return true;
    }
  }

  /**
   * Get nested object value from string path.
   * 
   * @example
   * getNestedValue({ user: { name: 'John' } }, 'user.name') // "John"
   * getNestedValue({ a: { b: { c: 42 } } }, 'a.b.c') // 42
   */
  getNestedValue(obj: any, path: string): any {
    if (!obj || !path) return undefined;
    return path.split('.').reduce((acc, part) => acc && acc[part], obj);
  }

  /**
   * Validate email address format.
   * 
   * @example
   * AuthUtils('user@example.com') // true
   * AuthUtils('invalid@') // false
   */
  AuthUtils(email: string): boolean {
    if (!email) return false;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Validate URL format.
   * 
   * @example
   * isValidUrl('https://example.com') // true
   * isValidUrl('not a url') // false
   */
  isValidUrl(url: string): boolean {
    if (!url) return false;
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Validate slug format (lowercase, alphanumeric, hyphens only).
   * 
   * @example
   * isValidSlug('my-slug') // true
   * isValidSlug('My Slug!') // false
   */
  isValidSlug(slug: string): boolean {
    if (!slug) return false;
    const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
    return slugRegex.test(slug);
  }

  /**
   * Check if value is empty (null, undefined, empty string, empty array).
   * 
   * @example
   * isEmpty(null) // true
   * isEmpty('') // true
   * isEmpty([]) // true
   * isEmpty('text') // false
   */
  isEmpty(value: any): boolean {
    if (value === null || value === undefined) return true;
    if (typeof value === 'string') return value.trim() === '';
    if (Array.isArray(value)) return value.length === 0;
    if (typeof value === 'object') return Object.keys(value).length === 0;
    return false;
  }

  /**
   * Check if value is numeric.
   * 
   * @example
   * isNumeric('123') // true
   * isNumeric('12.34') // true
   * isNumeric('abc') // false
   */
  isNumeric(value: any): boolean {
    if (value === null || value === undefined || value === '') return false;
    return !isNaN(Number(value));
  }

  /**
   * Validate minimum string length.
   */
  minLength(value: string, min: number): boolean {
    return String(value || '').length >= min;
  }

  /**
   * Validate maximum string length.
   */
  maxLength(value: string, max: number): boolean {
    return String(value || '').length <= max;
  }

  /**
   * Validate value is within range.
   */
  inRange(value: number, min: number, max: number): boolean {
    const num = Number(value);
    return !isNaN(num) && num >= min && num <= max;
  }
}