import { useEffect, useMemo, useRef, useState, type ElementType } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import {
  Command,
  Cpu,
  MessageCircle,
  Search,
  Server,
  Settings,
} from 'lucide-react';
import Fuse from 'fuse.js';
import { instanceDirectoryService } from '../services/index.ts';
import { useInstanceStore } from '../stores/useInstanceStore.ts';

interface InstanceSummary {
  id: string;
  name: string;
  ip: string;
  status: string;
}

interface CommandItem {
  id: string;
  title: string;
  subtitle?: string;
  icon: ElementType;
  action: () => void;
  category: string;
}

export function CommandPalette() {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [instances, setInstances] = useState<InstanceSummary[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const { setActiveInstanceId } = useInstanceStore();
  const { t } = useTranslation();

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'k' && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setIsOpen((open) => !open);
      }
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    setSearch('');
    setSelectedIndex(0);
    const timeoutId = window.setTimeout(() => inputRef.current?.focus(), 100);
    void instanceDirectoryService.listInstances().then(setInstances);

    return () => window.clearTimeout(timeoutId);
  }, [isOpen]);

  const commands = useMemo<CommandItem[]>(() => {
    const baseCommands: CommandItem[] = [
      {
        id: 'nav-instances',
        title: t('commandPalette.commands.instances.title'),
        subtitle: t('commandPalette.commands.instances.subtitle'),
        icon: Server,
        category: t('commandPalette.categories.navigation'),
        action: () => navigate('/instances'),
      },
      {
        id: 'nav-devices',
        title: t('commandPalette.commands.devices.title'),
        subtitle: t('commandPalette.commands.devices.subtitle'),
        icon: Cpu,
        category: t('commandPalette.categories.navigation'),
        action: () => navigate('/devices'),
      },
      {
        id: 'nav-chat',
        title: t('commandPalette.commands.chat.title'),
        subtitle: t('commandPalette.commands.chat.subtitle'),
        icon: MessageCircle,
        category: t('commandPalette.categories.navigation'),
        action: () => navigate('/chat'),
      },
      {
        id: 'nav-settings',
        title: t('commandPalette.commands.settings.title'),
        subtitle: t('commandPalette.commands.settings.subtitle'),
        icon: Settings,
        category: t('commandPalette.categories.navigation'),
        action: () => navigate('/settings'),
      },
    ];

    const instanceCommands: CommandItem[] = instances.map((instance) => ({
      id: `switch-instance-${instance.id}`,
      title: t('commandPalette.switchInstanceTitle', { name: instance.name }),
      subtitle: t('commandPalette.instanceSubtitle', {
        ip: instance.ip,
        status: instance.status,
      }),
      icon: Server,
      category: t('commandPalette.categories.instances'),
      action: () => setActiveInstanceId(instance.id),
    }));

    return [...baseCommands, ...instanceCommands];
  }, [instances, navigate, setActiveInstanceId, t]);

  const fuse = useMemo(
    () =>
      new Fuse(commands, {
        keys: ['title', 'subtitle', 'category'],
        threshold: 0.4,
        includeScore: true,
      }),
    [commands],
  );

  const filteredCommands = useMemo(() => {
    if (!search.trim()) {
      return commands;
    }

    return fuse.search(search).map((result) => result.item);
  }, [search, commands, fuse]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!isOpen || filteredCommands.length === 0) {
        return;
      }

      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setSelectedIndex((index) => (index + 1) % filteredCommands.length);
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        setSelectedIndex(
          (index) => (index - 1 + filteredCommands.length) % filteredCommands.length,
        );
      } else if (event.key === 'Enter') {
        event.preventDefault();
        filteredCommands[selectedIndex]?.action();
        setIsOpen(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [filteredCommands, isOpen, selectedIndex]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [search]);

  if (!isOpen) {
    return null;
  }

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-start justify-center px-4 pt-[15vh] sm:px-0">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={() => setIsOpen(false)}
          className="fixed inset-0 bg-zinc-950/40 backdrop-blur-sm"
        />

        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: -20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: -20 }}
          transition={{ type: 'spring', stiffness: 400, damping: 30, mass: 0.8 }}
          className="relative flex w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-zinc-200/50 bg-white/90 shadow-2xl backdrop-blur-2xl dark:border-zinc-800/50 dark:bg-zinc-900/90"
        >
          <div className="flex items-center border-b border-zinc-100 px-4 py-4 dark:border-zinc-800">
            <Search className="mr-3 h-5 w-5 shrink-0 text-zinc-400" />
            <input
              ref={inputRef}
              type="text"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t('commandPalette.searchPlaceholder')}
              className="flex-1 border-none bg-transparent text-lg text-zinc-900 outline-none placeholder:text-zinc-400 dark:text-zinc-100 dark:placeholder:text-zinc-500"
            />
            <div className="ml-3 flex items-center gap-1">
              <kbd className="rounded border border-zinc-200 bg-zinc-100 px-2 py-1 text-xs font-medium text-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400">
                ESC
              </kbd>
            </div>
          </div>

          <div className="max-h-[60vh] overflow-y-auto p-2">
            {filteredCommands.length === 0 ? (
              <div className="py-12 text-center text-zinc-500 dark:text-zinc-400">
                <Command className="mx-auto mb-3 h-8 w-8 opacity-20" />
                <p>{t('commandPalette.noResults')}</p>
              </div>
            ) : (
              <div className="space-y-1">
                {filteredCommands.map((command, index) => {
                  const Icon = command.icon;
                  const isSelected = index === selectedIndex;

                  return (
                    <button
                      key={command.id}
                      onClick={() => {
                        command.action();
                        setIsOpen(false);
                      }}
                      onMouseEnter={() => setSelectedIndex(index)}
                      className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left transition-colors ${
                        isSelected
                          ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
                          : 'text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800/50'
                      }`}
                    >
                      <Icon
                        className={`h-5 w-5 ${
                          isSelected
                            ? 'text-zinc-300 dark:text-zinc-600'
                            : 'text-zinc-400 dark:text-zinc-500'
                        }`}
                      />
                      <div className="min-w-0 flex-1">
                        <div
                          className={`text-sm font-medium ${
                            isSelected
                              ? 'text-white dark:text-zinc-900'
                              : 'text-zinc-900 dark:text-zinc-100'
                          }`}
                        >
                          {command.title}
                        </div>
                        {command.subtitle ? (
                          <div
                            className={`truncate text-xs ${
                              isSelected
                                ? 'text-zinc-400 dark:text-zinc-500'
                                : 'text-zinc-500 dark:text-zinc-400'
                            }`}
                          >
                            {command.subtitle}
                          </div>
                        ) : null}
                      </div>
                      {isSelected ? (
                        <kbd className="hidden rounded bg-white/10 px-2 py-1 text-[10px] font-medium uppercase tracking-wider text-zinc-300 dark:bg-black/10 dark:text-zinc-600 sm:block">
                          Enter
                        </kbd>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="flex items-center justify-between border-t border-zinc-100 bg-zinc-50/50 px-4 py-3 text-xs text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/50 dark:text-zinc-400">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1">
                <kbd className="rounded bg-zinc-200/50 px-1.5 py-0.5 dark:bg-zinc-800/50">↑</kbd>
                <kbd className="rounded bg-zinc-200/50 px-1.5 py-0.5 dark:bg-zinc-800/50">↓</kbd>
                {t('commandPalette.footer.navigationHint')}
              </span>
              <span className="flex items-center gap-1">
                <kbd className="rounded bg-zinc-200/50 px-1.5 py-0.5 dark:bg-zinc-800/50">
                  Enter
                </kbd>
                {t('commandPalette.footer.selectHint')}
              </span>
            </div>
            <div className="font-medium">{t('commandPalette.footer.title')}</div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
