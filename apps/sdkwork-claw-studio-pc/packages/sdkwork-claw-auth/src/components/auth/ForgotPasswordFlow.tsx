import { useEffect, useState, type FormEvent } from 'react';
import { ArrowRight, KeyRound, Lock, Mail, Smartphone } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import type { PasswordResetInput, PasswordResetRequestInput } from '@sdkwork/claw-core';
import { Button, Input, Label } from '@sdkwork/claw-ui';
import { AuthMethodTabs } from './AuthMethodTabs.tsx';
import {
  DEFAULT_AUTH_RECOVERY_METHODS,
  looksLikeEmailAddress,
  looksLikePhoneNumber,
  readErrorMessage,
  resolveAuthRecoveryMethods,
  resolveRecoveryChannel,
  type AuthRecoveryMethod,
} from './authConfig.ts';
import { useActionCooldown } from './useActionCooldown.ts';
import { VerificationCodeField } from './VerificationCodeField.tsx';

interface ForgotPasswordFlowProps {
  initialAccount?: string;
  onRequestReset: (payload: PasswordResetRequestInput) => Promise<void>;
  onSubmit: (payload: PasswordResetInput) => Promise<void>;
  methods?: AuthRecoveryMethod[];
}

export function ForgotPasswordFlow({
  initialAccount,
  onRequestReset,
  onSubmit,
  methods,
}: ForgotPasswordFlowProps) {
  const { t } = useTranslation();
  const enabledMethods = resolveAuthRecoveryMethods(methods);
  const [method, setMethod] = useState<AuthRecoveryMethod>('email');
  const [account, setAccount] = useState(initialAccount || '');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSendingCode, setIsSendingCode] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { isCoolingDown, remainingSeconds, resetCooldown, startCooldown } = useActionCooldown();

  const handleMethodChange = (nextMethod: AuthRecoveryMethod) => {
    if (nextMethod === method) {
      return;
    }

    setMethod(nextMethod);
    setAccount((current) => {
      const matchesNextMethod =
        nextMethod === 'email'
          ? looksLikeEmailAddress(current)
          : looksLikePhoneNumber(current);
      return matchesNextMethod ? current : '';
    });
    setCode('');
    setIsSendingCode(false);
    resetCooldown();
  };

  useEffect(() => {
    setAccount(initialAccount || '');
  }, [initialAccount]);

  useEffect(() => {
    if (enabledMethods.includes(method)) {
      return;
    }

    handleMethodChange(enabledMethods[0] || DEFAULT_AUTH_RECOVERY_METHODS[0]);
  }, [enabledMethods, method]);

  const isAccountValid =
    method === 'email'
      ? looksLikeEmailAddress(account)
      : looksLikePhoneNumber(account);

  const handleSendCode = async () => {
    if (!isAccountValid || isSendingCode) {
      return;
    }

    setIsSendingCode(true);

    try {
      await onRequestReset({
        account: account.trim(),
        channel: resolveRecoveryChannel(method),
      });
      startCooldown();
      toast.success(t('auth.toasts.resetCodeSent'));
    } catch (error) {
      toast.error(readErrorMessage(error, t('auth.errors.resetPasswordFailed')));
    } finally {
      setIsSendingCode(false);
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (isSubmitting) {
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error(t('auth.errors.passwordMismatch'));
      return;
    }

    if (!isAccountValid) {
      toast.error(
        method === 'email' ? t('auth.errors.invalidEmail') : t('auth.errors.invalidPhone'),
      );
      return;
    }

    setIsSubmitting(true);

    try {
      await onSubmit({
        account: account.trim(),
        code: code.trim(),
        newPassword,
        confirmPassword,
      });
      toast.success(t('auth.toasts.passwordResetSuccess'));
    } catch (error) {
      toast.error(readErrorMessage(error, t('auth.errors.resetPasswordFailed')));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {enabledMethods.length > 1 ? (
        <AuthMethodTabs
          value={method}
          onChange={(value) => handleMethodChange(value as AuthRecoveryMethod)}
          items={enabledMethods.map((item) => ({
            value: item,
            label: item === 'email' ? t('auth.email') : t('auth.phone'),
            icon:
              item === 'email'
                ? <Mail className="h-4 w-4" />
                : <Smartphone className="h-4 w-4" />,
          }))}
        />
      ) : null}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-2">
          <Label className="text-zinc-700 dark:text-zinc-300">
            {t('auth.forgotPasswordFields.account')}
          </Label>
          <div className="relative">
            {method === 'phone' ? (
              <Smartphone className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-zinc-400" />
            ) : (
              <Mail className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-zinc-400" />
            )}
            <Input
              type={method === 'phone' ? 'tel' : 'email'}
              value={account}
              onChange={(event) => setAccount(event.target.value)}
              placeholder={
                method === 'phone'
                  ? t('auth.placeholders.phone')
                  : t('auth.placeholders.email')
              }
              className="h-11 pl-10"
              autoComplete={method === 'phone' ? 'tel' : 'email'}
              required
            />
          </div>
        </div>

        <VerificationCodeField
          label={t('auth.forgotPasswordFields.code')}
          value={code}
          onChange={setCode}
          placeholder={t('auth.placeholders.verificationCode')}
          actionLabel={t('auth.actions.startReset')}
          resendLabel={t('auth.actions.resendCode')}
          onAction={() => {
            void handleSendCode();
          }}
          isSending={isSendingCode}
          isCoolingDown={isCoolingDown}
          remainingSeconds={remainingSeconds}
          disabled={!isAccountValid}
        />

        <div className="space-y-2">
          <Label className="text-zinc-700 dark:text-zinc-300">
            {t('auth.forgotPasswordFields.newPassword')}
          </Label>
          <div className="relative">
            <KeyRound className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-zinc-400" />
            <Input
              type="password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              placeholder={t('auth.placeholders.newPassword')}
              className="h-11 pl-10"
              autoComplete="new-password"
              required
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label className="text-zinc-700 dark:text-zinc-300">
            {t('auth.forgotPasswordFields.confirmPassword')}
          </Label>
          <div className="relative">
            <Lock className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-zinc-400" />
            <Input
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              placeholder={t('auth.placeholders.confirmPassword')}
              className="h-11 pl-10"
              autoComplete="new-password"
              required
            />
          </div>
        </div>

        <Button type="submit" disabled={isSubmitting} className="h-11 w-full font-bold">
          {isSubmitting ? t('common.loading') : t('auth.actions.completeReset')}
          <ArrowRight className="h-4 w-4" />
        </Button>
      </form>
    </div>
  );
}
