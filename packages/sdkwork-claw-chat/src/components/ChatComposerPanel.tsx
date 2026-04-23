import type { ComponentProps } from 'react';
import { ArrowDown } from 'lucide-react';
import { ChatInput } from './ChatInput';
import { CHAT_CHROME_JUMP_BUTTON_CLASS } from './chatChromeSurface';

export interface ChatComposerPanelProps {
  showJumpToLatest: boolean;
  hasMessages: boolean;
  jumpToLatestLabel: string;
  onJumpToLatest: () => void;
  inputProps: ComponentProps<typeof ChatInput>;
}

export function ChatComposerPanel({
  showJumpToLatest,
  hasMessages,
  jumpToLatestLabel,
  onJumpToLatest,
  inputProps,
}: ChatComposerPanelProps) {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">
      {showJumpToLatest && hasMessages ? (
        <div className="mb-3 flex justify-end">
          <button
            type="button"
            onClick={onJumpToLatest}
            className={CHAT_CHROME_JUMP_BUTTON_CLASS}
          >
            <ArrowDown className="h-3.5 w-3.5" />
            <span>{jumpToLatestLabel}</span>
          </button>
        </div>
      ) : null}
      <ChatInput {...inputProps} />
    </div>
  );
}
