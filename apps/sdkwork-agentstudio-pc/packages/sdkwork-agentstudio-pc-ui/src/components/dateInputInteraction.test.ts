import assert from 'node:assert/strict';
import {
  maybeOpenNativeDatePicker,
  supportsNativeDatePickerOpen,
} from './dateInputInteraction.ts';

function runTest(name: string, fn: () => void) {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

function createDateInput(overrides: Partial<HTMLInputElement & { showPicker?: () => void }> = {}) {
  return {
    disabled: false,
    readOnly: false,
    type: 'date',
    showPicker: () => undefined,
    ...overrides,
  } as HTMLInputElement & { showPicker?: () => void };
}

runTest('supportsNativeDatePickerOpen only returns true for editable date inputs with showPicker', () => {
  assert.equal(supportsNativeDatePickerOpen(createDateInput()), true);
  assert.equal(supportsNativeDatePickerOpen(createDateInput({ type: 'text' })), false);
  assert.equal(supportsNativeDatePickerOpen(createDateInput({ disabled: true })), false);
  assert.equal(supportsNativeDatePickerOpen(createDateInput({ readOnly: true })), false);
  assert.equal(supportsNativeDatePickerOpen(createDateInput({ showPicker: undefined })), false);
});

runTest('maybeOpenNativeDatePicker triggers showPicker once when supported', () => {
  let calls = 0;
  const input = createDateInput({
    showPicker: () => {
      calls += 1;
    },
  });

  assert.equal(maybeOpenNativeDatePicker(input), true);
  assert.equal(calls, 1);
});

runTest('maybeOpenNativeDatePicker safely falls back when picker opening is unsupported or throws', () => {
  const unsupportedInput = createDateInput({ showPicker: undefined });
  assert.equal(maybeOpenNativeDatePicker(unsupportedInput), false);

  const throwingInput = createDateInput({
    showPicker: () => {
      throw new Error('unsupported');
    },
  });
  assert.equal(maybeOpenNativeDatePicker(throwingInput), false);
});
