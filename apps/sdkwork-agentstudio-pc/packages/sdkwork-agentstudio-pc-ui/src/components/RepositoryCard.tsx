import React from 'react';
import { Download, GitBranch, GitFork, ShieldCheck, Star } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

export interface RepositoryCardProps {
  id: string;
  name: string;
  author: string;
  description: string;
  stars?: number;
  downloads?: number;
  forks?: number;
  tags: string[];
  type: 'github' | 'huggingface';
  onInstall: (id: string, name: string) => void;
  iconUrl?: string;
}

const HUGGING_FACE_MONOGRAM = 'HF';

export function RepositoryCard({
  id,
  name,
  author,
  description,
  stars,
  downloads,
  forks,
  tags,
  type,
  onInstall,
  iconUrl,
}: RepositoryCardProps) {
  const navigate = useNavigate();
  const { t } = useTranslation();

  const handleCardClick = () => {
    navigate(`/${type}/${id}`);
  };

  const handleInstallClick = (event: React.MouseEvent) => {
    event.stopPropagation();
    onInstall(id, `${author}/${name}`);
  };

  return (
    <div
      onClick={handleCardClick}
      className="group relative flex h-full cursor-pointer flex-col overflow-hidden rounded-[20px] border border-zinc-200/60 bg-white p-6 shadow-sm transition-all duration-300 hover:shadow-xl dark:border-zinc-800 dark:bg-zinc-900 dark:hover:shadow-primary-900/10"
    >
      <div className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-zinc-50 blur-3xl transition-colors group-hover:bg-primary-50/50 dark:bg-zinc-800/50 dark:group-hover:bg-primary-900/20" />

      <div className="relative z-10 mb-4 flex items-start gap-4">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-zinc-200/50 bg-zinc-100 shadow-sm dark:border-zinc-700/50 dark:bg-zinc-800">
          {iconUrl ? (
            <img
              src={iconUrl}
              alt={name}
              className="h-full w-full object-cover"
              referrerPolicy="no-referrer"
            />
          ) : type === 'github' ? (
            <GitBranch className="h-7 w-7 text-zinc-700 dark:text-zinc-300" />
          ) : (
            <span className="text-sm font-bold tracking-wide text-primary-600 dark:text-primary-400">
              {HUGGING_FACE_MONOGRAM}
            </span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex items-center gap-2">
            <span className="truncate text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              {author}
            </span>
            {stars && stars > 10000 ? (
              <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-primary-500" />
            ) : null}
          </div>
          <h3
            className="truncate text-lg font-bold text-zinc-900 transition-colors group-hover:text-primary-600 dark:text-zinc-100 dark:group-hover:text-primary-400"
            title={name}
          >
            {name}
          </h3>
        </div>
      </div>

      <p className="relative z-10 mb-6 line-clamp-2 flex-1 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
        {description}
      </p>

      <div className="relative z-10 mb-6 flex flex-wrap gap-2">
        {tags.slice(0, 3).map((tag) => (
          <span
            key={tag}
            className="rounded-lg border border-zinc-200/50 bg-zinc-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-zinc-600 dark:border-zinc-700/50 dark:bg-zinc-800 dark:text-zinc-300"
          >
            {tag}
          </span>
        ))}
        {tags.length > 3 ? (
          <span className="rounded-lg border border-zinc-100 bg-zinc-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-zinc-400 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-500">
            +{tags.length - 3}
          </span>
        ) : null}
      </div>

      <div className="relative z-10 flex items-center justify-between border-t border-zinc-100 pt-4 dark:border-zinc-800">
        <div className="flex items-center gap-4 text-xs font-medium text-zinc-500 dark:text-zinc-400">
          {stars !== undefined ? (
            <div className="flex items-center gap-1.5" title={t('repositoryCard.stats.stars')}>
              <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
              {stars > 1000 ? `${(stars / 1000).toFixed(1)}k` : stars}
            </div>
          ) : null}
          {downloads !== undefined ? (
            <div
              className="flex items-center gap-1.5"
              title={t('repositoryCard.stats.downloads')}
            >
              <Download className="h-4 w-4 text-primary-400" />
              {downloads > 1000000
                ? `${(downloads / 1000000).toFixed(1)}M`
                : downloads > 1000
                  ? `${(downloads / 1000).toFixed(1)}k`
                  : downloads}
            </div>
          ) : null}
          {forks !== undefined ? (
            <div className="flex items-center gap-1.5" title={t('repositoryCard.stats.forks')}>
              <GitFork className="h-4 w-4 text-zinc-400 dark:text-zinc-500" />
              {forks > 1000 ? `${(forks / 1000).toFixed(1)}k` : forks}
            </div>
          ) : null}
        </div>

        <button
          onClick={handleInstallClick}
          className="flex items-center gap-2 rounded-xl bg-zinc-900 px-4 py-2 text-xs font-bold text-white shadow-sm transition-colors hover:bg-primary-600 hover:shadow-md active:scale-95 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-primary-500"
        >
          <Download className="h-3.5 w-3.5" />
          {type === 'github'
            ? t('repositoryCard.actions.clone')
            : t('repositoryCard.actions.download')}
        </button>
      </div>
    </div>
  );
}
