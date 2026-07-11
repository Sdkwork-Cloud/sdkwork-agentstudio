import { X } from 'lucide-react';
import { type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '../lib/utils';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from './Dialog';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  className?: string;
}

export function Modal({
  isOpen,
  onClose,
  title,
  children,
  className,
}: ModalProps) {
  const { t } = useTranslation();

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) {
          onClose();
        }
      }}
    >
      <DialogContent
        showCloseButton={false}
        className={cn(
          'max-w-md border-zinc-200/70 p-0 dark:border-zinc-800/70',
          className,
        )}
      >
        <DialogHeader className="flex-row items-center justify-between space-y-0 border-b border-zinc-100 px-6 py-5 dark:border-zinc-800">
          <DialogTitle className="text-xl font-semibold tracking-tight">
            {title}
          </DialogTitle>
          <DialogClose asChild>
            <button
              type="button"
              className="rounded-full p-2 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 focus:ring-offset-white dark:hover:bg-zinc-800 dark:hover:text-zinc-300 dark:focus:ring-offset-zinc-950"
            >
              <X className="h-5 w-5" />
              <span className="sr-only">{t('common.close')}</span>
            </button>
          </DialogClose>
        </DialogHeader>
        <div className="overflow-y-auto p-6">{children}</div>
      </DialogContent>
    </Dialog>
  );
}
