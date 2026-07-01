export interface NativeDateInputLike {
  disabled?: boolean;
  readOnly?: boolean;
  type?: string;
  showPicker?: (() => void) | undefined;
}

export function supportsNativeDatePickerOpen(
  input: NativeDateInputLike | null | undefined,
): input is NativeDateInputLike & { showPicker: () => void } {
  return Boolean(
    input &&
      input.type === 'date' &&
      !input.disabled &&
      !input.readOnly &&
      typeof input.showPicker === 'function',
  );
}

export function maybeOpenNativeDatePicker(
  input: NativeDateInputLike | null | undefined,
): boolean {
  if (!supportsNativeDatePickerOpen(input)) {
    return false;
  }

  try {
    input.showPicker();
    return true;
  } catch {
    return false;
  }
}

export function shouldOpenDatePickerFromKey(key: string) {
  return key === 'Enter' || key === ' ' || key === 'ArrowDown';
}
