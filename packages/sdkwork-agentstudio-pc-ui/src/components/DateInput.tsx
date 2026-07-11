import * as React from 'react';
import { CalendarDays } from 'lucide-react';
import { cn } from '../lib/utils';
import { inputBaseClassName, type InputProps } from './Input';
import {
  maybeOpenNativeDatePicker,
  shouldOpenDatePickerFromKey,
} from './dateInputInteraction';

export interface DateInputProps extends Omit<InputProps, 'type'> {
  calendarLabel?: string;
}

const DateInput = React.forwardRef<HTMLInputElement, DateInputProps>(
  (
    {
      calendarLabel = 'Open calendar',
      className,
      onClick,
      onKeyDown,
      onPointerDown,
      ...props
    },
    ref,
  ) => {
    const inputRef = React.useRef<HTMLInputElement | null>(null);
    const openedOnPointerDownRef = React.useRef(false);

    React.useImperativeHandle(ref, () => inputRef.current as HTMLInputElement, []);

    const setInputRef = (node: HTMLInputElement | null) => {
      inputRef.current = node;

      if (typeof ref === 'function') {
        ref(node);
        return;
      }

      if (ref) {
        ref.current = node;
      }
    };

    const handlePointerDown = (event: React.PointerEvent<HTMLInputElement>) => {
      onPointerDown?.(event);
      openedOnPointerDownRef.current = false;

      if (event.defaultPrevented || event.button !== 0) {
        return;
      }

      openedOnPointerDownRef.current = maybeOpenNativeDatePicker(event.currentTarget);
    };

    const handleClick = (event: React.MouseEvent<HTMLInputElement>) => {
      onClick?.(event);

      if (!event.defaultPrevented && !openedOnPointerDownRef.current) {
        maybeOpenNativeDatePicker(event.currentTarget);
      }

      openedOnPointerDownRef.current = false;
    };

    const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
      onKeyDown?.(event);

      if (event.defaultPrevented || !shouldOpenDatePickerFromKey(event.key)) {
        return;
      }

      if (maybeOpenNativeDatePicker(event.currentTarget)) {
        event.preventDefault();
      }
    };

    const handleCalendarPointerDown = (
      event: React.PointerEvent<HTMLButtonElement>,
    ) => {
      event.preventDefault();
    };

    const handleCalendarClick = () => {
      const input = inputRef.current;

      if (!input || input.disabled || input.readOnly) {
        return;
      }

      input.focus({ preventScroll: true });

      if (!maybeOpenNativeDatePicker(input)) {
        input.click();
      }
    };

    return (
      <div className="group relative" data-slot="date-input">
        <input
          {...props}
          ref={setInputRef}
          type="date"
          className={cn(
            inputBaseClassName,
            'cursor-pointer pr-14 [color-scheme:light] [transition:background-color_160ms_ease,border-color_160ms_ease,box-shadow_160ms_ease,transform_160ms_ease] [-webkit-tap-highlight-color:transparent] [appearance:none] [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:right-0 [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:w-14 [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-0 dark:[color-scheme:dark]',
            className,
          )}
          onPointerDown={handlePointerDown}
          onClick={handleClick}
          onKeyDown={handleKeyDown}
        />
        <button
          type="button"
          tabIndex={-1}
          aria-hidden="true"
          title={calendarLabel}
          className="absolute right-1.5 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg border border-zinc-200 bg-zinc-50 text-zinc-500 transition-all duration-150 group-hover:border-primary-200 group-hover:bg-primary-50 group-hover:text-primary-600 group-focus-within:scale-[1.02] group-focus-within:border-primary-300 group-focus-within:bg-primary-50 group-focus-within:text-primary-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400 dark:group-hover:border-primary-500/30 dark:group-hover:bg-primary-500/10 dark:group-hover:text-primary-300 dark:group-focus-within:border-primary-500/35 dark:group-focus-within:bg-primary-500/10 dark:group-focus-within:text-primary-300"
          onPointerDown={handleCalendarPointerDown}
          onClick={handleCalendarClick}
        >
          <CalendarDays className="h-4 w-4" />
        </button>
      </div>
    );
  },
);
DateInput.displayName = 'DateInput';

export { DateInput };
