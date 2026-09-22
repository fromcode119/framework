import { TimePart } from '@/components/ui/date-time-picker/enums/time-part.enum';
import { FieldSize } from '@/components/ui/enums/field-size.enum';
import type { ReactNode } from 'react';
import { bound, prop, ref, state, watch } from '@fromcode119/react-class-components';
import type { Ref } from '@fromcode119/react-class-components';
import { AdminComponent } from '@/components/view/admin-component.client';
import { DateTimePickerPopover } from '@/components/ui/date-time-picker/view/popover.client';
import { DateTimePickerTrigger } from '@/components/ui/date-time-picker/view/trigger.client';
import { DateTimePickerController } from '@/components/ui/date-time-picker/controller';
import { DateTimePickerGranularity } from '@/components/ui/date-time-picker/enums/date-time-picker-granularity.enum';
import { DateTimePickerGranularPopover } from '@/components/ui/date-time-picker/view/granular-popover.client';
import { DateTimePickerTimePopover } from '@/components/ui/date-time-picker/view/time-popover.client';
import type { IDateTimePickerCoords } from '@/components/ui/date-time-picker/interfaces/date-time-picker-coords.interface';

export class DateTimePicker extends AdminComponent {
  @prop declare value?: string;
  @prop declare onChange: (value: string | null) => void;
  @prop declare disabled?: boolean;
  @prop declare showTime?: boolean;
  @prop declare granularity?: DateTimePickerGranularity;
  @prop declare placeholder?: string;
  @prop declare className?: string;
  @prop declare size?: FieldSize;
  /** TIME granularity only: how far one press of the minute stepper moves. Defaults to 5. */
  @prop declare minuteStep?: number;

  @ref declare containerRef: Ref<HTMLDivElement>;
  @ref declare popoverRef: Ref<HTMLDivElement>;

  @state isOpen = false;
  @state coords: IDateTimePickerCoords = { top: 0, left: 0, width: 0 };
  @state visibleMonth: Date = DateTimePickerController.getPickerDate(this.expandedValue) || new Date();
  @state isJumpViewOpen = false;

  private get timezone(): string {
    return DateTimePickerController.timezone;
  }

  private get resolvedGranularity(): DateTimePickerGranularity {
    if (this.granularity) return this.granularity;
    return this.showTime === false ? DateTimePickerGranularity.DATE : DateTimePickerGranularity.DATETIME;
  }

  /**
   * Whether the popover offers a time of day.
   *
   * GRANULARITY decides, because that is what the prop promises: "what the operator picks (and what
   * onChange emits)". It did not — the time row, the commit and the auto-close all keyed off
   * `showTime`, which defaults to true — so `granularity={DATE}` still rendered hour and minute
   * steppers under a date-only field, and every caller had to remember to pass `showTime={false}`
   * as well to get what they had already asked for.
   *
   * An explicit `showTime` still wins, so existing callers that pass it keep their behaviour.
   */
  private get showsTimeOfDay(): boolean {
    if (typeof this.showTime === 'boolean') return this.showTime;
    return this.resolvedGranularity === DateTimePickerGranularity.DATETIME
      || this.resolvedGranularity.isTimeOfDay;
  }

  private get expandedValue(): string | undefined {
    // A `HH:mm` is not a date. Handing it to the date parsing yields an Invalid Date that renders
    // as the placeholder, so the trigger would show "Select time..." over a value that IS set.
    if (this.resolvedGranularity.isTimeOfDay) return undefined;
    return this.value ? this.resolvedGranularity.expandValue(this.value) : this.value;
  }

  @bound private handleGranularPick(year: number, monthIndex: number | null): void {
    this.onChange(monthIndex === null ? String(year) : `${year}-${String(monthIndex + 1).padStart(2, '0')}`);
    this.isOpen = false;
  }

  @bound private handleTimePick(next: string): void {
    this.onChange(next);
  }

  @bound private clearTime(): void {
    this.onChange(null);
  }

  private get zonedParts() {
    return DateTimePickerController.getZonedParts(this.expandedValue);
  }

  private get utcDate(): Date | null {
    return DateTimePickerController.getUtcDate(this.expandedValue);
  }

  private get pickerDate(): Date | undefined {
    return DateTimePickerController.getPickerDate(this.expandedValue);
  }

  @bound private updatePosition(): void {
    if (this.containerRef.current) {
      const rect = this.containerRef.current.getBoundingClientRect();
      this.coords = DateTimePickerController.computeCoords(rect, this.showsTimeOfDay, this.resolvedGranularity);
    }
  }

  @bound private handleClickOutside(event: MouseEvent): void {
    if (
      this.containerRef.current && !this.containerRef.current.contains(event.target as Node) &&
      this.popoverRef.current && !this.popoverRef.current.contains(event.target as Node)
    ) {
      this.isOpen = false;
    }
  }

  private addPositionListeners(): void {
    this.updatePosition();
    window.addEventListener('scroll', this.updatePosition, true);
    window.addEventListener('resize', this.updatePosition);
  }

  private removePositionListeners(): void {
    window.removeEventListener('scroll', this.updatePosition, true);
    window.removeEventListener('resize', this.updatePosition);
  }

  componentDidMount(): void {
    this.listen(document, 'mousedown', this.handleClickOutside as EventListener);
    if (this.isOpen) this.addPositionListeners();
  }

  @watch('isOpen') private onOpenChanged(isOpen: boolean): void {
    if (isOpen) {
      // Sync the visible month to the selected value when the picker first opens.
      const base = this.zonedParts;
      this.visibleMonth = base ? new Date(base.year, base.month - 1, 1) : new Date();
      this.isJumpViewOpen = false;
      this.addPositionListeners();
    } else {
      this.removePositionListeners();
    }
  }

  componentWillUnmount(): void {
    this.removePositionListeners();
  }

  private commitDate(selectedDate: Date, shouldClose: boolean): void {
    this.onChange(DateTimePickerController.computeCommitIso(
      { value: this.value, showTime: this.showsTimeOfDay, onChange: this.onChange },
      selectedDate,
    ));
    this.visibleMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
    if (shouldClose) this.isOpen = false;
  }

  @bound private handleSelect(selectedDate: Date | undefined): void {
    if (!selectedDate) {
      this.onChange(null);
      return;
    }
    this.commitDate(selectedDate, !this.showsTimeOfDay);
  }

  @bound private handleTimeChange(type: TimePart, val: string): void {
    const iso = DateTimePickerController.computeTimeChangeIso(this.value, type, val);
    if (iso === null) return;
    this.onChange(iso);
  }

  @bound private shiftVisibleMonth(monthOffset: number): void {
    const month = this.visibleMonth;
    this.visibleMonth = new Date(month.getFullYear(), month.getMonth() + monthOffset, 1);
  }

  @bound private shiftVisibleYear(yearOffset: number): void {
    const month = this.visibleMonth;
    this.visibleMonth = new Date(month.getFullYear() + yearOffset, month.getMonth(), 1);
  }

  @bound private handleJumpMonthSelect(monthIndex: number): void {
    const month = this.visibleMonth;
    this.visibleMonth = new Date(month.getFullYear(), monthIndex, 1);
    this.isJumpViewOpen = false;
  }

  @bound private applyQuickAction(dayOffset: number): void {
    const quickDate = new Date();
    quickDate.setDate(quickDate.getDate() + dayOffset);
    this.commitDate(quickDate, !this.showsTimeOfDay);
  }

  @bound private handleClear(): void {
    this.onChange(null);
    this.visibleMonth = new Date();
    if (!this.showsTimeOfDay) this.isOpen = false;
  }

  @bound private toggleOpen(): void {
    this.isOpen = !this.isOpen;
  }

  @bound private clearValue(): void {
    this.onChange(null);
  }

  @bound private jumpToSelected(): void {
    this.visibleMonth = this.pickerDate || new Date();
  }

  @bound private toggleJumpView(): void {
    this.isJumpViewOpen = !this.isJumpViewOpen;
  }

  @bound private setVisibleMonth(next: Date): void {
    this.visibleMonth = next;
  }

  @bound private close(): void {
    this.isOpen = false;
  }

  render(): ReactNode {
    const showTime = this.showsTimeOfDay;
    const isTime = this.resolvedGranularity.isTimeOfDay;
    const placeholder = this.placeholder ?? (isTime ? 'Select time...' : 'Select date...');
    const className = this.className ?? '';
    const size = this.size ?? FieldSize.MD;

    return (
    <div className={`relative w-full ${className}`} ref={this.containerRef}>
      <DateTimePickerTrigger
        granularity={this.resolvedGranularity}
        size={size}
        isOpen={this.isOpen}
        disabled={this.disabled}
        value={this.value}
        utcDate={this.utcDate}
        showTime={showTime}
        placeholder={placeholder}
        timezone={this.timezone}
        onToggle={this.toggleOpen}
        onClear={this.clearValue}
      />

      {this.isOpen && isTime && (
        <DateTimePickerTimePopover
          theme={this.theme}
          value={this.value}
          minuteStep={this.minuteStep ?? 5}
          coords={this.coords}
          popoverRef={this.popoverRef}
          onChange={this.handleTimePick}
          onClear={this.clearTime}
          onClose={this.close}
        />
      )}

      {this.isOpen && !isTime && !this.resolvedGranularity.usesCalendar && (
        <DateTimePickerGranularPopover
          theme={this.theme}
          granularity={this.resolvedGranularity}
          selectedYear={this.zonedParts ? this.zonedParts.year : null}
          selectedMonth={this.zonedParts ? this.zonedParts.month - 1 : null}
          coords={this.coords}
          popoverRef={this.popoverRef}
          onPick={this.handleGranularPick}
        />
      )}

      {this.isOpen && this.resolvedGranularity.usesCalendar && (
        <DateTimePickerPopover
          theme={this.theme}
          showTime={showTime}
          timezone={this.timezone}
          placeholder={placeholder}
          value={this.value}
          coords={this.coords}
          visibleMonth={this.visibleMonth}
          isJumpViewOpen={this.isJumpViewOpen}
          utcDate={this.utcDate}
          zonedParts={this.zonedParts}
          pickerDate={this.pickerDate}
          popoverRef={this.popoverRef}
          onJumpToSelected={this.jumpToSelected}
          onShiftMonth={this.shiftVisibleMonth}
          onToggleJumpView={this.toggleJumpView}
          onShiftYear={this.shiftVisibleYear}
          onJumpMonthSelect={this.handleJumpMonthSelect}
          onSelect={this.handleSelect}
          onVisibleMonthChange={this.setVisibleMonth}
          onTimeChange={this.handleTimeChange}
          onQuickAction={this.applyQuickAction}
          onClear={this.handleClear}
          onClose={this.close}
        />
      )}
    </div>
    );
  }
}
