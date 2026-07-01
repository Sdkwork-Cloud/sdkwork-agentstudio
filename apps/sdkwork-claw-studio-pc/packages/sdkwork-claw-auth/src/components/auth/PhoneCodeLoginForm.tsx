import { useEffect, useState, type FormEvent } from 'react';
import { ArrowRight, Smartphone } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { appAuthService } from '@sdkwork/claw-core';
import { Button, Input, Label } from '@sdkwork/claw-ui';
import { looksLikePhoneNumber, readErrorMessage } from './authConfig.ts';
import { useActionCooldown } from './useActionCooldown.ts';
import { VerificationCodeField } from './VerificationCodeField.tsx';

interface PhoneCodeLoginFormProps {
  initialPhone?: string;
  onSubmit: (payload: { phone: string; code: string }) => Promise<void>;
}

export function PhoneCodeLoginForm({
  initialPhone,
  onSubmit,
}: PhoneCodeLoginFormProps) {
  const { t } = useTranslation();
  const [phone, setPhone] = useState(initialPhone || '');
  const [code, setCode] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSendingCode, setIsSendingCode] = useState(false);
  const { isCoolingDown, remainingSeconds, startCooldown } = useActionCooldown();
  const isPhoneValid = looksLikePhoneNumber(phone);

  useEffect(() => {
    setPhone(initialPhone || '');
  }, [initialPhone]);

  const handleSendCode = async () => {
    if (!isPhoneValid || isSendingCode) {
      return;
    }

    setIsSendingCode(true);

    try {
      await appAuthService.sendVerifyCode({
        target: phone.trim(),
        verifyType: 'PHONE',
        scene: 'LOGIN',
      });
      startCooldown();
      toast.success(t('auth.toasts.codeSent'));
    } catch (error) {
      toast.error(readErrorMessage(error, t('auth.errors.sendCodeFailed')));
    } finally {
      setIsSendingCode(false);
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (isSubmitting) {
      return;
    }

    if (!isPhoneValid) {
      toast.error(t('auth.errors.invalidPhone'));
      return;
    }

    setIsSubmitting(true);

    try {
      await onSubmit({
        phone: phone.trim(),
        code: code.trim(),
      });
    } catch (error) {
      toast.error(readErrorMessage(error, t('auth.errors.signInFailed')));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="space-y-2">
        <Label className="text-zinc-700 dark:text-zinc-300">{t('auth.phone')}</Label>
        <div className="relative">
          <Smartphone className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-zinc-400" />
          <Input
            type="tel"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            placeholder={t('auth.placeholders.phone')}
            className="h-11 pl-10"
            autoComplete="tel"
            required
          />
        </div>
      </div>

      <VerificationCodeField
        label={t('auth.verificationCode')}
        value={code}
        onChange={setCode}
        placeholder={t('auth.placeholders.verificationCode')}
        actionLabel={t('auth.actions.sendCode')}
        resendLabel={t('auth.actions.resendCode')}
        onAction={() => {
          void handleSendCode();
        }}
        isSending={isSendingCode}
        isCoolingDown={isCoolingDown}
        remainingSeconds={remainingSeconds}
        disabled={!isPhoneValid}
      />

      <Button type="submit" disabled={isSubmitting} className="h-11 w-full font-bold">
        {isSubmitting ? t('common.loading') : t('auth.signIn')}
        <ArrowRight className="h-4 w-4" />
      </Button>
    </form>
  );
}
