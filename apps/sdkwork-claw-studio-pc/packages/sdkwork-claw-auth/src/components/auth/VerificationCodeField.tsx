import { LoaderCircle } from 'lucide-react';
import { Button, Input, Label } from '@sdkwork/claw-ui';

interface VerificationCodeFieldProps {
  label: string;
  value: string;
  placeholder: string;
  actionLabel: string;
  resendLabel: string;
  onChange: (value: string) => void;
  onAction: () => void;
  autoComplete?: string;
  required?: boolean;
  isSending?: boolean;
  isCoolingDown?: boolean;
  remainingSeconds?: number;
  disabled?: boolean;
}

export function VerificationCodeField({
  label,
  value,
  placeholder,
  actionLabel,
  resendLabel,
  onChange,
  onAction,
  autoComplete = 'one-time-code',
  required = true,
  isSending = false,
  isCoolingDown = false,
  remainingSeconds = 0,
  disabled = false,
}: VerificationCodeFieldProps) {
  const actionText = isCoolingDown
    ? `${resendLabel} (${remainingSeconds}s)`
    : actionLabel;

  return (
    <div className="space-y-2">
      <Label className="text-zinc-700 dark:text-zinc-300">{label}</Label>
      <div className="flex gap-3">
        <Input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          className="h-11"
          autoComplete={autoComplete}
          required={required}
        />
        <Button
          type="button"
          variant="outline"
          disabled={disabled || isSending || isCoolingDown}
          onClick={onAction}
          className="h-11 min-w-[132px] shrink-0 font-semibold"
        >
          {isSending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
          {actionText}
        </Button>
      </div>
    </div>
  );
}
