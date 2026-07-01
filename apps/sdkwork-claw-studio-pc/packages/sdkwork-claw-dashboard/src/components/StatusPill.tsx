export function StatusPill({
  label,
  tone,
}: {
  label: string;
  tone: 'positive' | 'warning' | 'critical' | 'neutral';
}) {
  const tones = {
    positive:
      'border border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
    warning:
      'border border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300',
    critical:
      'border border-rose-500/20 bg-rose-500/10 text-rose-700 dark:text-rose-300',
    neutral:
      'border border-zinc-500/15 bg-zinc-950/[0.04] text-zinc-600 dark:bg-white/[0.08] dark:text-zinc-300',
  };

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${tones[tone]}`}
    >
      {label}
    </span>
  );
}
