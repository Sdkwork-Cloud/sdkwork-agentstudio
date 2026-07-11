import { Menu, Settings2 } from 'lucide-react';
import { CHAT_CHROME_FLOATING_BUTTON_CLASS } from './chatChromeSurface';

export interface ChatTopControlsProps {
  expandSidebarLabel: string;
  openSessionContextLabel: string;
  onOpenSidebar: () => void;
  onClick: () => void;
}

export function ChatTopControls({
  expandSidebarLabel,
  openSessionContextLabel,
  onOpenSidebar,
  onClick,
}: ChatTopControlsProps) {
  return (
    <>
      <div className="pointer-events-none absolute left-2.5 top-2.5 z-20 sm:left-3 sm:top-3 lg:hidden">
        <button
          type="button"
          onClick={onOpenSidebar}
          className={CHAT_CHROME_FLOATING_BUTTON_CLASS}
          aria-label={expandSidebarLabel}
          title={expandSidebarLabel}
        >
          <Menu className="h-[18px] w-[18px]" />
        </button>
      </div>

      <div className="pointer-events-none absolute right-2.5 top-2.5 z-20 sm:right-3 sm:top-3 lg:right-4">
        <button
          type="button"
          onClick={onClick}
          className={CHAT_CHROME_FLOATING_BUTTON_CLASS}
          aria-label={openSessionContextLabel}
          title={openSessionContextLabel}
        >
          <Settings2 className="h-[18px] w-[18px]" />
        </button>
      </div>
    </>
  );
}
