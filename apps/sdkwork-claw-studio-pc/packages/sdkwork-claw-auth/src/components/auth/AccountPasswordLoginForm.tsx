import { useEffect, useState, type FormEvent } from 'react';
import { ArrowRight, Lock, UserCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { Button, Input, Label } from '@sdkwork/claw-ui';
import { readErrorMessage } from './authConfig.ts';

interface AccountPasswordLoginFormProps {
  initialAccount?: string;
  onSubmit: (payload: { account: string; password: string }) => Promise<void>;
}

export function AccountPasswordLoginForm({
  initialAccount,
  onSubmit,
}: AccountPasswordLoginFormProps) {
  const { t } = useTranslation();
  const [account, setAccount] = useState(initialAccount || '');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setAccount(initialAccount || '');
  }, [initialAccount]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (isSubmitting) {
      return;
    }

    setIsSubmitting(true);

    try {
      await onSubmit({
        account: account.trim(),
        password,
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
        <Label className="text-zinc-700 dark:text-zinc-300">{t('auth.account')}</Label>
        <div className="relative">
          <UserCircle2 className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-zinc-400" />
          <Input
            type="text"
            value={account}
            onChange={(event) => setAccount(event.target.value)}
            placeholder={t('auth.placeholders.account')}
            className="h-11 pl-10"
            autoComplete="username"
            required
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-zinc-700 dark:text-zinc-300">{t('auth.password')}</Label>
        <div className="relative">
          <Lock className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-zinc-400" />
          <Input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder={t('auth.placeholders.password')}
            className="h-11 pl-10"
            autoComplete="current-password"
            required
          />
        </div>
      </div>

      <Button type="submit" disabled={isSubmitting} className="h-11 w-full font-bold">
        {isSubmitting ? t('common.loading') : t('auth.signIn')}
        <ArrowRight className="h-4 w-4" />
      </Button>
    </form>
  );
}
