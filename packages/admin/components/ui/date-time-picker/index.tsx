"use client";

import React from 'react';
import { AdminComponent } from '@/components/admin-component';
import { DateTimePickerPopover } from './popover';
import { DateTimePickerTrigger } from './trigger';
import { DateTimePickerController } from './controller';
import type { DateTimePickerProps, DateTimePickerState } from './interfaces';

export class DateTimePicker extends AdminComponent<DateTimePickerProps, DateTimePickerState> {
  private readonly containerRef = React.createRef<HTMLDivElement>();
  private readonly popoverRef = React.createRef<HTMLDivElement>();

  state: DateTimePickerState = {
    isOpen: false,
    coords: { top: 0, left: 0, width: 0 },
    visibleMonth: DateTimePickerController.getPickerDate(this.props.value) || new Date(),
    isJumpViewOpen: false,
  };

  private get timezone(): string {
    return DateTimePickerController.timezone;
  }

  private getZonedParts() {
    return DateTimePickerController.getZonedParts(this.props.value);
  }

  private updatePosition = (): void => {
    if (this.containerRef.current) {
      const rect = this.containerRef.current.getBoundingClientRect();
      this.setState({ coords: DateTimePickerController.computeCoords(rect, this.props.showTime) });
    }
  };

  private handleClickOutside = (event: MouseEvent): void => {
    if (
      this.containerRef.current && !this.containerRef.current.contains(event.target as Node) &&
      this.popoverRef.current && !this.popoverRef.current.contains(event.target as Node)
    ) {
      this.setState({ isOpen: false });
    }
  };

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
    document.addEventListener('mousedown', this.handleClickOutside);
    if (this.state.isOpen) this.addPositionListeners();
  }

  componentDidUpdate(_prevProps: DateTimePickerProps, prevState: DateTimePickerState): void {
    if (prevState.isOpen !== this.state.isOpen) {
      if (this.state.isOpen) {
        // Sync the visible month to the selected value when the picker first opens.
        const base = this.getZonedParts();
        const openMonth = base ? new Date(base.year, base.month - 1, 1) : new Date();
        this.setState({ visibleMonth: openMonth, isJumpViewOpen: false });
        this.addPositionListeners();
      } else {
        this.removePositionListeners();
      }
    }
  }

  componentWillUnmount(): void {
    document.removeEventListener('mousedown', this.handleClickOutside);
    this.removePositionListeners();
  }

  private commitDate = (selectedDate: Date, shouldClose: boolean): void => {
    this.props.onChange(DateTimePickerController.computeCommitIso(this.props, selectedDate));
    this.setState({ visibleMonth: new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1) });
    if (shouldClose) this.setState({ isOpen: false });
  };

  private handleSelect = (selectedDate: Date | undefined): void => {
    if (!selectedDate) {
      this.props.onChange(null);
      return;
    }
    this.commitDate(selectedDate, this.props.showTime === false);
  };

  private handleTimeChange = (type: 'hours' | 'minutes', val: string): void => {
    const iso = DateTimePickerController.computeTimeChangeIso(this.props.value, type, val);
    if (iso === null) return;
    this.props.onChange(iso);
  };

  private shiftVisibleMonth = (monthOffset: number): void => {
    const { visibleMonth } = this.state;
    this.setState({ visibleMonth: new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + monthOffset, 1) });
  };

  private shiftVisibleYear = (yearOffset: number): void => {
    const { visibleMonth } = this.state;
    this.setState({ visibleMonth: new Date(visibleMonth.getFullYear() + yearOffset, visibleMonth.getMonth(), 1) });
  };

  private handleJumpMonthSelect = (monthIndex: number): void => {
    const { visibleMonth } = this.state;
    this.setState({ visibleMonth: new Date(visibleMonth.getFullYear(), monthIndex, 1), isJumpViewOpen: false });
  };

  private applyQuickAction = (dayOffset: number): void => {
    const quickDate = new Date();
    quickDate.setDate(quickDate.getDate() + dayOffset);
    this.commitDate(quickDate, this.props.showTime === false);
  };

  private handleClear = (): void => {
    this.props.onChange(null);
    this.setState({ visibleMonth: new Date() });
    if (this.props.showTime === false) {
      this.setState({ isOpen: false });
    }
  };

  render(): React.ReactNode {
    const {
      value, onChange, disabled, showTime = true, placeholder = 'Select date...', className = '', size = 'md',
    } = this.props;
    const { isOpen, coords, visibleMonth, isJumpViewOpen } = this.state;
    const theme = this.theme;
    const timezone = this.timezone;
    const utcDate = DateTimePickerController.getUtcDate(value);
    const zonedParts = this.getZonedParts();
    const pickerDate = DateTimePickerController.getPickerDate(value);

    return (
    <div className={`relative w-full ${className}`} ref={this.containerRef}>
      <DateTimePickerTrigger
        size={size}
        isOpen={isOpen}
        disabled={disabled}
        value={value}
        utcDate={utcDate}
        showTime={showTime}
        placeholder={placeholder}
        timezone={timezone}
        onToggle={() => this.setState({ isOpen: !isOpen })}
        onClear={() => onChange(null)}
      />

      {isOpen && (
        <DateTimePickerPopover
          theme={theme}
          showTime={showTime}
          timezone={timezone}
          placeholder={placeholder}
          value={value}
          coords={coords}
          visibleMonth={visibleMonth}
          isJumpViewOpen={isJumpViewOpen}
          utcDate={utcDate}
          zonedParts={zonedParts}
          pickerDate={pickerDate}
          popoverRef={this.popoverRef}
          onJumpToSelected={() => this.setState({ visibleMonth: pickerDate || new Date() })}
          onShiftMonth={this.shiftVisibleMonth}
          onToggleJumpView={() => this.setState((current) => ({ isJumpViewOpen: !current.isJumpViewOpen }))}
          onShiftYear={this.shiftVisibleYear}
          onJumpMonthSelect={this.handleJumpMonthSelect}
          onSelect={this.handleSelect}
          onVisibleMonthChange={(next) => this.setState({ visibleMonth: next })}
          onTimeChange={this.handleTimeChange}
          onQuickAction={this.applyQuickAction}
          onClear={this.handleClear}
          onClose={() => this.setState({ isOpen: false })}
        />
      )}
    </div>
    );
  }
}
