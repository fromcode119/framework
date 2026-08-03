import { TimePart } from '@/components/ui/date-time-picker/enums/time-part.enum';
import { FieldSize } from '@/components/ui/enums/field-size.enum';
import type { ReactNode } from 'react';
import { bound, prop, ref, state, watch } from '@fromcode119/reactor';
import type { Ref } from '@fromcode119/reactor';
import { AdminComponent } from '@/components/view/admin-component.client';
import { DateTimePickerPopover } from '@/components/ui/date-time-picker/view/popover.client';
import { DateTimePickerTrigger } from '@/components/ui/date-time-picker/view/trigger.client';
import { DateTimePickerController } from '@/components/ui/date-time-picker/controller';
import type { IDateTimePickerCoords } from '@/components/ui/date-time-picker/interfaces/date-time-picker-coords.interface';

export class DateTimePicker extends AdminComponent {
  @prop declare value?: string;
  @prop declare onChange: (value: string | null) => void;
  @prop declare disabled?: boolean;
  @prop declare showTime?: boolean;
  @prop declare placeholder?: string;
  @prop declare className?: string;
  @prop declare size?: FieldSize;

  @ref declare containerRef: Ref<HTMLDivElement>;
  @ref declare popoverRef: Ref<HTMLDivElement>;

  @state isOpen = false;
  @state coords: IDateTimePickerCoords = { top: 0, left: 0, width: 0 };
  @state visibleMonth: Date = DateTimePickerController.getPickerDate(this.value) || new Date();
  @state isJumpViewOpen = false;

  private get timezone(): string {
    return DateTimePickerController.timezone;
  }

  private get zonedParts() {
    return DateTimePickerController.getZonedParts(this.value);
  }

  private get utcDate(): Date | null {
    return DateTimePickerController.getUtcDate(this.value);
  }

  private get pickerDate(): Date | undefined {
    return DateTimePickerController.getPickerDate(this.value);
  }

  @bound private updatePosition(): void {
    if (this.containerRef.current) {
      const rect = this.containerRef.current.getBoundingClientRect();
      this.coords = DateTimePickerController.computeCoords(rect, this.showTime);
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
      { value: this.value, showTime: this.showTime, onChange: this.onChange },
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
    this.commitDate(selectedDate, this.showTime === false);
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
    this.commitDate(quickDate, this.showTime === false);
  }

  @bound private handleClear(): void {
    this.onChange(null);
    this.visibleMonth = new Date();
    if (this.showTime === false) this.isOpen = false;
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
    const showTime = this.showTime ?? true;
    const placeholder = this.placeholder ?? 'Select date...';
    const className = this.className ?? '';
    const size = this.size ?? FieldSize.MD;

    return (
    <div className={`relative w-full ${className}`} ref={this.containerRef}>
      <DateTimePickerTrigger
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

      {this.isOpen && (
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
