import type { ElementType } from 'react';
import {
  Activity,
  Cpu,
  LayoutDashboard,
  MessageCircle,
  Server,
  Settings,
  ShieldCheck,
  Waypoints,
} from 'lucide-react';

export interface CommandPaletteInstance {
  id: string;
  name: string;
  ip: string;
  status: string;
}

export interface CommandPaletteCommand {
  id: string;
  title: string;
  subtitle?: string;
  icon: ElementType;
  action: () => void;
  category: string;
}

interface BuildCommandPaletteCommandsOptions {
  instances: CommandPaletteInstance[];
  navigate: (path: string) => void;
  setActiveInstanceId: (id: string | null) => void;
  t: (key: string, options?: Record<string, unknown>) => string;
}

export function buildCommandPaletteCommands({
  instances,
  navigate,
  setActiveInstanceId,
  t,
}: BuildCommandPaletteCommandsOptions): CommandPaletteCommand[] {
  const baseCommands: CommandPaletteCommand[] = [
    {
      id: 'nav-chat',
      title: t('commandPalette.commands.chat.title'),
      subtitle: t('commandPalette.commands.chat.subtitle'),
      icon: MessageCircle,
      category: t('commandPalette.categories.navigation'),
      action: () => navigate('/chat'),
    },
    {
      id: 'nav-dashboard',
      title: t('commandPalette.commands.dashboard.title'),
      subtitle: t('commandPalette.commands.dashboard.subtitle'),
      icon: LayoutDashboard,
      category: t('commandPalette.categories.navigation'),
      action: () => navigate('/dashboard'),
    },
    {
      id: 'nav-usage',
      title: t('commandPalette.commands.usage.title'),
      subtitle: t('commandPalette.commands.usage.subtitle'),
      icon: Activity,
      category: t('commandPalette.categories.navigation'),
      action: () => navigate('/usage'),
    },
    {
      id: 'nav-upload',
      title: t('commandPalette.commands.upload.title'),
      subtitle: t('commandPalette.commands.upload.subtitle'),
      icon: Waypoints,
      category: t('commandPalette.categories.navigation'),
      action: () => navigate('/claw-center'),
    },
    {
      id: 'nav-instances',
      title: t('commandPalette.commands.instances.title'),
      subtitle: t('commandPalette.commands.instances.subtitle'),
      icon: Server,
      category: t('commandPalette.categories.navigation'),
      action: () => navigate('/instances'),
    },
    {
      id: 'nav-kernel',
      title: t('commandPalette.commands.kernel.title'),
      subtitle: t('commandPalette.commands.kernel.subtitle'),
      icon: ShieldCheck,
      category: t('commandPalette.categories.navigation'),
      action: () => navigate('/kernel'),
    },
    {
      id: 'nav-nodes',
      title: t('commandPalette.commands.nodes.title'),
      subtitle: t('commandPalette.commands.nodes.subtitle'),
      icon: Server,
      category: t('commandPalette.categories.navigation'),
      action: () => navigate('/nodes'),
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
      id: 'nav-settings',
      title: t('commandPalette.commands.settings.title'),
      subtitle: t('commandPalette.commands.settings.subtitle'),
      icon: Settings,
      category: t('commandPalette.categories.navigation'),
      action: () => navigate('/settings'),
    },
  ];

  const instanceCommands: CommandPaletteCommand[] = instances.map((instance) => ({
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
}
