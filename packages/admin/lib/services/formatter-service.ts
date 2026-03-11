import { BaseService } from './base-service';
import { TimezoneUtils } from '../timezone';

/**
 * Service for formatting values into human-readable strings.
 * 
 * Handles:
 * - File sizes (bytes → KB, MB, GB)
 * - Dates and times (timezone-aware)
 * - Numbers and currencies
 * - Durations
 */
export class FormatterService extends BaseService {
  /**
   * Formats a number of bytes into a human-readable string (KB, MB, GB, etc.)
   * 
   * @example
   * formatSize(1024) // "1.0 KB"
   * formatSize(1048576) // "1.0 MB"
   * formatSize(0) // "0 B"
   */
  formatSize(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    const formattedValue = parseFloat((bytes / Math.pow(k, i)).toFixed(1));
    return `${formattedValue} ${sizes[i]}`;
  }

  /**
   * Format date to localized string (timezone-aware via system settings).
   * 
   * @example
   * formatDate(new Date()) // "2026-03-08 14:30:00"
   * formatDate('2026-03-08') // "2026-03-08 00:00:00"
   */
  formatDate(value: any): string {
    return TimezoneUtils.formatSystemDateTime(value);
  }

  /**
   * Format a number with thousand separators.
   * 
   * @example
   * formatNumber(1234567) // "1,234,567"
   * formatNumber(1234.56) // "1,234.56"
   */
  formatNumber(value: number, decimals?: number): string {
    if (typeof value !== 'number' || isNaN(value)) return '0';
    const fixed = decimals !== undefined ? value.toFixed(decimals) : String(value);
    return fixed.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }

  /**
   * Format a number as currency.
   * 
   * @example
   * formatCurrency(1234.56, 'USD') // "$1,234.56"
   * formatCurrency(1234.56, 'EUR') // "€1,234.56"
   */
  formatCurrency(value: number, currency: string = 'USD'): string {
    if (typeof value !== 'number' || isNaN(value)) return '$0.00';
    
    try {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: currency.toUpperCase(),
      }).format(value);
    } catch {
      // Fallback for invalid currency codes
      const symbols: Record<string, string> = {
        USD: '$',
        EUR: '€',
        GBP: '£',
      };
      const symbol = symbols[currency.toUpperCase()] || currency;
      return `${symbol}${this.formatNumber(value, 2)}`;
    }
  }

  /**
   * Format duration in milliseconds to human-readable string.
   * 
   * @example
   * formatDuration(1000) // "1s"
   * formatDuration(65000) // "1m 5s"
   * formatDuration(3665000) // "1h 1m 5s"
   */
  formatDuration(ms: number): string {
    if (ms < 1000) return `${ms}ms`;
    
    const seconds = Math.floor((ms / 1000) % 60);
    const minutes = Math.floor((ms / (1000 * 60)) % 60);
    const hours = Math.floor(ms / (1000 * 60 * 60));

    const parts: string[] = [];
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);
    if (seconds > 0) parts.push(`${seconds}s`);

    return parts.join(' ') || '0s';
  }

  /**
   * Format percentage.
   * 
   * @example
   * formatPercent(0.1234) // "12.34%"
   * formatPercent(0.5) // "50%"
   */
  formatPercent(value: number, decimals: number = 0): string {
    if (typeof value !== 'number' || isNaN(value)) return '0%';
    return `${(value * 100).toFixed(decimals)}%`;
  }
}