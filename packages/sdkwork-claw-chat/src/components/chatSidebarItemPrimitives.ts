export const CHAT_SIDEBAR_ROW_BUTTON_CLASS =
  'flex w-full min-w-0 items-center gap-3 rounded-[0.75rem] px-3 py-3 text-left transition-colors disabled:cursor-wait';

export const CHAT_SIDEBAR_ROW_AVATAR_SHELL_CLASS =
  'relative flex h-10 w-10 shrink-0 items-center justify-center rounded-[0.56rem] text-[11px] font-semibold uppercase transition-colors';

export const CHAT_SIDEBAR_ROW_AVATAR_INNER_CLASS =
  'flex h-full w-full items-center justify-center rounded-[0.56rem] transition-colors';

export const CHAT_SIDEBAR_AGENT_ROW_BUTTON_CLASS =
  'relative flex h-12 w-full min-w-0 items-center gap-2.5 rounded-lg px-2.5 text-left transition-all disabled:cursor-wait';

export const CHAT_SIDEBAR_AGENT_AVATAR_SHELL_CLASS =
  'relative flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[10px] font-semibold uppercase transition-colors';

export const CHAT_SIDEBAR_AGENT_NAME_CLASS =
  'min-w-0 flex-1 truncate text-[13px] font-medium leading-5 transition-colors';

export const CHAT_SIDEBAR_PRIMARY_BADGE_CLASS =
  'shrink-0 rounded-md bg-primary-500/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-primary-700 dark:bg-primary-400/15 dark:text-primary-200';

export const CHAT_SIDEBAR_TITLE_TEXT_CLASS =
  'block w-full min-w-0 truncate text-[13px] font-medium leading-5 transition-colors';

export const CHAT_SIDEBAR_PREVIEW_TEXT_CLASS =
  'mt-1 truncate text-[12px] leading-5 transition-colors';

export const CHAT_SIDEBAR_TIME_LABEL_CLASS =
  'ml-auto shrink-0 text-[10px] font-medium tabular-nums';

export const SESSION_OWNER_SLOT_CLASS =
  'inline-flex w-[6.75rem] min-w-0 shrink-0 items-center rounded-md bg-zinc-900/[0.045] px-1.5 py-0.5 text-[10px] font-medium text-zinc-500 dark:bg-white/[0.08] dark:text-zinc-300';

export const SESSION_KERNEL_SLOT_CLASS =
  'inline-flex h-5 w-8 shrink-0 items-center justify-center rounded-md bg-zinc-900/[0.055] px-1 text-[10px] font-semibold uppercase tabular-nums tracking-[0.04em] text-zinc-500 dark:bg-white/[0.08] dark:text-zinc-300';

export const CHAT_SIDEBAR_KERNEL_BADGE_CLASS = SESSION_KERNEL_SLOT_CLASS;

export function resolveKernelBadgeLabel(label?: string | null) {
  const normalizedLabel = label?.trim();
  if (!normalizedLabel) {
    return 'AI';
  }

  const semanticTokens = normalizedLabel
    .replace(/([a-z\d])([A-Z])/g, '$1 $2')
    .split(/[^A-Za-z0-9]+/g)
    .filter(Boolean);
  const semanticInitials = semanticTokens
    .map((token) => token[0] ?? '')
    .join('')
    .toUpperCase();
  if (semanticInitials.length >= 2) {
    return semanticInitials.slice(0, 2);
  }

  const alphanumeric = (normalizedLabel.match(/[A-Za-z0-9]+/g) ?? []).join('');
  if (!alphanumeric) {
    return normalizedLabel.slice(0, 2).toUpperCase();
  }

  if (semanticInitials.length === 1) {
    return `${semanticInitials}${alphanumeric.slice(1, 2)}`.toUpperCase().slice(0, 2);
  }

  return alphanumeric.slice(0, 2).toUpperCase();
}
