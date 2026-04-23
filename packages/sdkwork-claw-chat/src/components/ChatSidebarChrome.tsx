import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import type { CreateKernelAgentResult } from '@sdkwork/claw-core';
import { cn } from '@sdkwork/claw-ui';
import type {
  ChatAgentCreationFollowUpResult,
  ChatSidebarAgentActionRequest,
  ChatSidebarAgentOption,
  ChatSidebarAgentSelection,
  ChatSidebarSelectionActionResult,
  ChatSidebarSessionSelection,
} from '../services';
import type { ChatSession } from '../store/useChatStore';
import { ChatSidebar } from './ChatSidebar';

const CHAT_SIDEBAR_WIDTH_STORAGE_KEY = 'claw-studio.chat.sidebar.width';
const CHAT_SIDEBAR_MIN_WIDTH = 256;
const CHAT_SIDEBAR_MAX_WIDTH = 448;
const CHAT_SIDEBAR_DEFAULT_WIDTH = 288;
const CHAT_SIDEBAR_XL_DEFAULT_WIDTH = 320;
const CHAT_SIDEBAR_CONVERSATION_MIN_WIDTH = 560;

function readStoredSidebarWidth() {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const rawValue = window.localStorage.getItem(CHAT_SIDEBAR_WIDTH_STORAGE_KEY);
    if (!rawValue) {
      return null;
    }

    const parsedWidth = Number(rawValue);
    return Number.isFinite(parsedWidth) ? parsedWidth : null;
  } catch {
    return null;
  }
}

function persistSidebarWidth(width: number) {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.setItem(CHAT_SIDEBAR_WIDTH_STORAGE_KEY, String(width));
  } catch {
    // Ignore persistence failures and keep the in-memory width.
  }
}

function resolveSidebarWidthLimits() {
  if (typeof window === 'undefined') {
    return {
      min: CHAT_SIDEBAR_MIN_WIDTH,
      max: CHAT_SIDEBAR_MAX_WIDTH,
    };
  }

  const viewportMaxWidth = Math.max(
    CHAT_SIDEBAR_MIN_WIDTH,
    Math.min(
      CHAT_SIDEBAR_MAX_WIDTH,
      Math.floor(window.innerWidth * 0.42),
      window.innerWidth - CHAT_SIDEBAR_CONVERSATION_MIN_WIDTH,
    ),
  );

  return {
    min: CHAT_SIDEBAR_MIN_WIDTH,
    max: viewportMaxWidth,
  };
}

function clampSidebarWidth(width: number) {
  const { min, max } = resolveSidebarWidthLimits();
  return Math.min(max, Math.max(min, Math.round(width)));
}

function resolveDefaultSidebarWidth() {
  if (typeof window === 'undefined') {
    return CHAT_SIDEBAR_DEFAULT_WIDTH;
  }

  return clampSidebarWidth(
    window.innerWidth >= 1280 ? CHAT_SIDEBAR_XL_DEFAULT_WIDTH : CHAT_SIDEBAR_DEFAULT_WIDTH,
  );
}

type ChatSidebarRenderProps = {
  className?: string;
  sessions: ChatSession[];
  activeSessionId: string | null;
  onDeleteSession?: (sessionId: string, instanceId?: string) => Promise<void> | void;
  activeInstanceId?: string | null;
  onSessionSelect?: (
    selection?: ChatSidebarSessionSelection,
  ) =>
    | Promise<ChatSidebarSelectionActionResult | void>
    | ChatSidebarSelectionActionResult
    | void;
  onSelectAgent?: (
    selection: ChatSidebarAgentSelection,
  ) =>
    | Promise<ChatSidebarSelectionActionResult | void>
    | ChatSidebarSelectionActionResult
    | void;
  onAgentCreated?: (
    result: CreateKernelAgentResult,
  ) =>
    | Promise<ChatAgentCreationFollowUpResult | void>
    | ChatAgentCreationFollowUpResult
    | void;
  onClose?: () => void;
  isChatSupported?: boolean;
  sessionScopeMode?: 'all' | 'agentBound';
  sessionScopeAgentId?: string | null;
  selectedAgentId?: string | null | undefined;
  primaryAgentId?: string | null;
  agentOptions?: ChatSidebarAgentOption[];
  hiddenAgentIds?: string[];
  selectionErrorMessage?: string | null;
  onDismissSelectionError?: () => void;
  onAgentAction?: (request: ChatSidebarAgentActionRequest) => Promise<void> | void;
};

export interface ChatSidebarChromeProps {
  isSidebarOpen: boolean;
  closeSidebar: () => void;
  sidebarBackdropLabel: string;
  desktopSidebarProps: ChatSidebarRenderProps;
  mobileSidebarProps: ChatSidebarRenderProps;
}

export function ChatSidebarChrome({
  isSidebarOpen,
  closeSidebar,
  sidebarBackdropLabel,
  desktopSidebarProps,
  mobileSidebarProps,
}: ChatSidebarChromeProps) {
  const resizeHandleRef = useRef<HTMLDivElement | null>(null);
  const resizeSessionRef = useRef<{
    pointerId: number | null;
    startClientX: number;
    startWidth: number;
  } | null>(null);
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const storedWidth = readStoredSidebarWidth();
    return clampSidebarWidth(storedWidth ?? resolveDefaultSidebarWidth());
  });
  const [isResizeHandleHovered, setIsResizeHandleHovered] = useState(false);
  const [isResizingSidebar, setIsResizingSidebar] = useState(false);

  const handleDesktopSidebarReset = () => {
    setSidebarWidth(resolveDefaultSidebarWidth());
  };

  const stopDesktopSidebarResize = () => {
    const activePointerId = resizeSessionRef.current?.pointerId ?? null;
    const resizeHandle = resizeHandleRef.current;
    if (
      resizeHandle &&
      activePointerId !== null &&
      resizeHandle.hasPointerCapture?.(activePointerId)
    ) {
      resizeHandle.releasePointerCapture(activePointerId);
    }

    resizeSessionRef.current = null;
    setIsResizingSidebar(false);
    document.body.style.userSelect = '';
    document.body.style.cursor = '';
    document.documentElement.style.cursor = '';
  };

  const handleDesktopSidebarResizeDrag = (event: PointerEvent | React.PointerEvent<HTMLDivElement>) => {
    const resizeSession = resizeSessionRef.current;
    if (!resizeSession) {
      return;
    }

    if (resizeSession.pointerId !== null && event.pointerId !== resizeSession.pointerId) {
      return;
    }

    const nextWidth = clampSidebarWidth(
      resizeSession.startWidth + (event.clientX - resizeSession.startClientX),
    );
    setSidebarWidth(nextWidth);
  };

  useEffect(() => {
    persistSidebarWidth(sidebarWidth);
  }, [sidebarWidth]);

  useEffect(() => {
    const handleWindowResize = () => {
      setSidebarWidth((currentWidth) => clampSidebarWidth(currentWidth));
    };

    window.addEventListener('resize', handleWindowResize);
    return () => {
      window.removeEventListener('resize', handleWindowResize);
    };
  }, []);

  useEffect(() => {
    return () => {
      stopDesktopSidebarResize();
    };
  }, []);

  return (
    <>
      <div
        className="group/chat-sidebar-resize relative hidden h-full shrink-0 lg:flex"
        style={{ width: `${sidebarWidth}px` }}
      >
        <ChatSidebar {...desktopSidebarProps} />
        <div
          ref={resizeHandleRef}
          className="absolute inset-y-0 right-[-6px] z-20 hidden w-3 cursor-col-resize touch-none lg:flex"
          onMouseEnter={() => setIsResizeHandleHovered(true)}
          onMouseLeave={() => setIsResizeHandleHovered(false)}
          onDoubleClick={handleDesktopSidebarReset}
          onPointerMove={(event) => {
            handleDesktopSidebarResizeDrag(event);
          }}
          onPointerUp={(event) => {
            const activePointerId = resizeSessionRef.current?.pointerId ?? null;
            if (activePointerId !== null && event.pointerId !== activePointerId) {
              return;
            }

            stopDesktopSidebarResize();
          }}
          onPointerCancel={() => {
            stopDesktopSidebarResize();
          }}
          onLostPointerCapture={() => {
            stopDesktopSidebarResize();
          }}
          onPointerDown={(event) => {
            if (event.button !== 0) {
              return;
            }

            event.preventDefault();
            event.currentTarget.setPointerCapture(event.pointerId);
            resizeSessionRef.current = {
              pointerId: event.pointerId,
              startClientX: event.clientX,
              startWidth: sidebarWidth,
            };
            setIsResizingSidebar(true);
            document.body.style.userSelect = 'none';
            document.body.style.cursor = 'col-resize';
            document.documentElement.style.cursor = 'col-resize';
          }}
        >
          <span
            className={cn(
              'pointer-events-none absolute inset-y-4 left-1/2 w-px -translate-x-1/2 rounded-full transition-colors duration-150',
              isResizeHandleHovered || isResizingSidebar
                ? 'bg-primary-500/75 shadow-[0_0_0_1px_rgba(59,130,246,0.12)] dark:bg-primary-300/85'
                : 'bg-zinc-300/0 dark:bg-zinc-700/0',
            )}
          />
          <span
            className={cn(
              'pointer-events-none absolute inset-y-0 left-1/2 w-[11px] -translate-x-1/2 rounded-full transition-colors duration-150',
              isResizeHandleHovered || isResizingSidebar
                ? 'bg-primary-500/[0.08] dark:bg-primary-400/[0.12]'
                : 'bg-transparent',
            )}
          />
        </div>
      </div>
      <AnimatePresence>
        {isSidebarOpen ? (
          <>
            <motion.button
              key="chat-sidebar-backdrop"
              type="button"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={closeSidebar}
              className="fixed inset-0 z-40 bg-zinc-950/45 backdrop-blur-sm lg:hidden"
              aria-label={sidebarBackdropLabel}
            />
            <motion.div
              key="chat-sidebar-drawer"
              initial={{ x: -32, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -32, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 360, damping: 32 }}
              className="fixed inset-y-0 left-0 z-50 w-[min(22rem,calc(100vw-1rem))] lg:hidden"
            >
              <ChatSidebar {...mobileSidebarProps} />
            </motion.div>
          </>
        ) : null}
      </AnimatePresence>
    </>
  );
}
