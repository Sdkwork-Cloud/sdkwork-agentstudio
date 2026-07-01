import { useEffect, useState, type FormEvent } from 'react';
import { ArrowRight, Lock, Mail, Smartphone, UserCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { appAuthService, type RegisterInput } from '@sdkwork/claw-core';
import { Button, Input, Label } from '@sdkwork/claw-ui';
import { AuthMethodTabs } from './AuthMethodTabs.tsx';
import {
  DEFAULT_AUTH_REGISTER_METHODS,
  looksLikeEmailAddress,
  looksLikePhoneNumber,
  readErrorMessage,
  resolveAuthRegisterMethods,
  type AuthRegisterMethod,
} from './authConfig.ts';
import { useActionCooldown } from './useActionCooldown.ts';
import { VerificationCodeField } from './VerificationCodeField.tsx';

interface RegisterFlowProps {
  onSubmit: (payload: RegisterInput) => Promise<void>;
  methods?: AuthRegisterMethod[];
}

export function RegisterFlow({ onSubmit, methods }: RegisterFlowProps) {
  const { t } = useTranslation();
  const enabledMethods = resolveAuthRegisterMethods(methods);
  const [method, setMethod] = useState<AuthRegisterMethod>('email');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSendingCode, setIsSendingCode] = useState(false);
  const { isCoolingDown, remainingSeconds, resetCooldown, startCooldown } = useActionCooldown();

  const handleMethodChange = (nextMethod: AuthRegisterMethod) => {
    if (nextMethod === method) {
      return;
    }

    setMethod(nextMethod);
    setVerificationCode('');
    setIsSendingCode(false);
    resetCooldown();
  };

  useEffect(() => {
    if (enabledMethods.includes(method)) {
      return;
    }

    handleMethodChange(enabledMethods[0] || DEFAULT_AUTH_REGISTER_METHODS[0]);
  }, [enabledMethods, method]);

  const target = method === 'email' ? email.trim() : phone.trim();
  const isTargetValid =
    method === 'email'
      ? looksLikeEmailAddress(email)
      : looksLikePhoneNumber(phone);

  const handleSendCode = async () => {
    if (!isTargetValid || isSendingCode) {
      return;
    }

    setIsSendingCode(true);

    try {
      await appAuthService.sendVerifyCode({
        target,
        verifyType: method === 'email' ? 'EMAIL' : 'PHONE',
        scene: 'REGISTER',
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

    if (password !== confirmPassword) {
      toast.error(t('auth.errors.passwordMismatch'));
      return;
    }

    if (!isTargetValid) {
      toast.error(
        method === 'email' ? t('auth.errors.invalidEmail') : t('auth.errors.invalidPhone'),
      );
      return;
    }

    setIsSubmitting(true);

    try {
      await onSubmit({
        username: username.trim(),
        email: method === 'email' ? email.trim() : undefined,
        phone: method === 'phone' ? phone.trim() : undefined,
        password,
        confirmPassword,
        verificationCode: verificationCode.trim(),
        channel: method === 'email' ? 'EMAIL' : 'PHONE',
      });
      toast.success(t('auth.toasts.registerSuccess'));
    } catch (error) {
      toast.error(readErrorMessage(error, t('auth.errors.registrationFailed')));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {enabledMethods.length > 1 ? (
        <AuthMethodTabs
          value={method}
          onChange={(value) => handleMethodChange(value as AuthRegisterMethod)}
          items={enabledMethods.map((item) => ({
            value: item,
            label:
              item === 'email'
                ? t('auth.registerMethods.email')
                : t('auth.registerMethods.phone'),
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
            {t('auth.registerFields.username')}
          </Label>
          <div className="relative">
            <UserCircle2 className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-zinc-400" />
            <Input
              type="text"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              placeholder={t('auth.placeholders.username')}
              className="h-11 pl-10"
              autoComplete="username"
              required
            />
          </div>
        </div>

        {method === 'email' ? (
          <div className="space-y-2">
            <Label className="text-zinc-700 dark:text-zinc-300">
              {t('auth.registerFields.email')}
            </Label>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-zinc-400" />
              <Input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder={t('auth.placeholders.email')}
                className="h-11 pl-10"
                autoComplete="email"
                required
              />
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <Label className="text-zinc-700 dark:text-zinc-300">
              {t('auth.registerFields.phone')}
            </Label>
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
        )}

        <VerificationCodeField
          label={t('auth.registerFields.verificationCode')}
          value={verificationCode}
          onChange={setVerificationCode}
          placeholder={t('auth.placeholders.verificationCode')}
          actionLabel={t('auth.actions.sendCode')}
          resendLabel={t('auth.actions.resendCode')}
          onAction={() => {
            void handleSendCode();
          }}
          isSending={isSendingCode}
          isCoolingDown={isCoolingDown}
          remainingSeconds={remainingSeconds}
          disabled={!isTargetValid}
        />

        <div className="space-y-2">
          <Label className="text-zinc-700 dark:text-zinc-300">
            {t('auth.registerFields.password')}
          </Label>
          <div className="relative">
            <Lock className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-zinc-400" />
            <Input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder={t('auth.placeholders.password')}
              className="h-11 pl-10"
              autoComplete="new-password"
              required
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label className="text-zinc-700 dark:text-zinc-300">
            {t('auth.registerFields.confirmPassword')}
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
          {isSubmitting ? t('common.loading') : t('auth.signUp')}
          <ArrowRight className="h-4 w-4" />
        </Button>
      </form>
    </div>
  );
}
