import { Suspense, lazy } from 'react';
import { Sparkles } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const NewPostWorkspace = lazy(() =>
  import('./NewPostWorkspace').then((module) => ({
    default: module.NewPostWorkspace,
  })),
);

function NewPostWorkspaceFallback() {
  const { t } = useTranslation();

  return (
    <div className="min-h-full bg-[linear-gradient(180deg,_#f8fafc_0%,_#eef2ff_24%,_#f8fafc_100%)] dark:bg-[linear-gradient(180deg,_#09090b_0%,_#101827_30%,_#09090b_100%)]">
      <div className="mx-auto max-w-6xl px-6 py-10 pb-28">
        <div className="mb-8 rounded-[2rem] bg-[linear-gradient(135deg,_#0f172a_0%,_#1d4ed8_58%,_#1e293b_100%)] p-7 text-white shadow-[0_24px_80px_rgba(29,78,216,0.22)]">
          <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-blue-100">
            <Sparkles className="h-3.5 w-3.5" />
            {t('community.newPost.hero.badge')}
          </div>
          <h1 className="text-3xl font-black tracking-tight md:text-4xl">
            {t('community.newPost.hero.title')}
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-blue-50/85 md:text-base">
            {t('community.newPost.hero.description')}
          </p>
        </div>

        <div className="rounded-[2rem] border border-zinc-200 bg-white/90 p-10 shadow-sm dark:border-zinc-800 dark:bg-zinc-950/70">
          <div className="flex min-h-[24rem] flex-col items-center justify-center gap-5">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary-500 border-t-transparent" />
            <div className="max-w-md text-center text-sm leading-7 text-zinc-500 dark:text-zinc-400">
              {t('common.loading')}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function NewPost() {
  return (
    <Suspense fallback={<NewPostWorkspaceFallback />}>
      <NewPostWorkspace />
    </Suspense>
  );
}
