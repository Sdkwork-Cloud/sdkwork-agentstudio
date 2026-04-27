import { useEffect, useRef, useState, type RefObject, type UIEvent } from 'react';
import {
  isChatViewportNearBottom,
  resolveChatAutoScrollDecision,
  resolveChatMessageScrollSignature,
} from '../services';
import type { Message } from '../store/useChatStore';

export interface UseChatAutoScrollInput {
  sessionId: string | null;
  messages: Message[];
  isBusy: boolean;
}

export interface UseChatAutoScrollResult {
  messagesScrollContainerRef: RefObject<HTMLDivElement | null>;
  showJumpToLatest: boolean;
  handleMessageListScroll: (event: UIEvent<HTMLDivElement>) => void;
  jumpToLatest: () => void;
}

export function useChatAutoScroll({
  sessionId,
  messages,
  isBusy,
}: UseChatAutoScrollInput): UseChatAutoScrollResult {
  const [showJumpToLatest, setShowJumpToLatest] = useState(false);
  const messagesScrollContainerRef = useRef<HTMLDivElement>(null);
  const chatHasAutoScrolledRef = useRef(false);
  const chatUserNearBottomRef = useRef(true);
  const chatScrollRetryTimeoutRef = useRef<number | null>(null);
  const messageScrollSignature = resolveChatMessageScrollSignature(messages);

  const clearChatScrollRetry = () => {
    if (chatScrollRetryTimeoutRef.current !== null) {
      window.clearTimeout(chatScrollRetryTimeoutRef.current);
      chatScrollRetryTimeoutRef.current = null;
    }
  };

  const scrollChatToLatest = (force = false) => {
    const container = messagesScrollContainerRef.current;
    if (!container) {
      return;
    }

    const decision = resolveChatAutoScrollDecision({
      force,
      hasAutoScrolled: chatHasAutoScrolledRef.current,
      userNearBottom: chatUserNearBottomRef.current,
      scrollHeight: container.scrollHeight,
      scrollTop: container.scrollTop,
      clientHeight: container.clientHeight,
    });
    chatHasAutoScrolledRef.current = decision.nextHasAutoScrolled;

    if (!decision.shouldScroll) {
      setShowJumpToLatest(decision.showJumpToLatest);
      return;
    }

    const applyScroll = (behavior: ScrollBehavior) => {
      const target = messagesScrollContainerRef.current;
      if (!target) {
        return;
      }

      if (typeof target.scrollTo === 'function') {
        target.scrollTo({
          top: target.scrollHeight,
          behavior,
        });
      } else {
        target.scrollTop = target.scrollHeight;
      }

      chatUserNearBottomRef.current = true;
      setShowJumpToLatest(false);
    };

    window.requestAnimationFrame(() => {
      applyScroll('auto');
      clearChatScrollRetry();
      const shouldForceRetry = decision.effectiveForce;
      chatScrollRetryTimeoutRef.current = window.setTimeout(() => {
        const target = messagesScrollContainerRef.current;
        if (!target) {
          return;
        }

        const shouldStickRetry =
          shouldForceRetry ||
          chatUserNearBottomRef.current ||
          isChatViewportNearBottom({
            scrollHeight: target.scrollHeight,
            scrollTop: target.scrollTop,
            clientHeight: target.clientHeight,
          });
        if (!shouldStickRetry) {
          return;
        }

        applyScroll('auto');
      }, decision.effectiveForce ? 150 : 120);
    });
  };

  const jumpToLatest = () => {
    clearChatScrollRetry();
    const target = messagesScrollContainerRef.current;
    if (!target) {
      return;
    }

    if (typeof target.scrollTo === 'function') {
      target.scrollTo({
        top: target.scrollHeight,
        behavior: 'smooth',
      });
    } else {
      target.scrollTop = target.scrollHeight;
    }

    chatHasAutoScrolledRef.current = true;
    chatUserNearBottomRef.current = true;
    setShowJumpToLatest(false);
  };

  useEffect(() => {
    chatHasAutoScrolledRef.current = false;
    chatUserNearBottomRef.current = true;
    setShowJumpToLatest(false);
    clearChatScrollRetry();

    const frame = window.requestAnimationFrame(() => {
      scrollChatToLatest(true);
    });

    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, [sessionId]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      scrollChatToLatest(false);
    });

    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, [isBusy, messageScrollSignature]);

  useEffect(
    () => () => {
      clearChatScrollRetry();
    },
    [],
  );

  const handleMessageListScroll = (event: UIEvent<HTMLDivElement>) => {
    const container = event.currentTarget;
    const userNearBottom = isChatViewportNearBottom({
      scrollHeight: container.scrollHeight,
      scrollTop: container.scrollTop,
      clientHeight: container.clientHeight,
    });
    chatUserNearBottomRef.current = userNearBottom;
    if (userNearBottom) {
      setShowJumpToLatest(false);
    }
  };

  return {
    messagesScrollContainerRef,
    showJumpToLatest,
    handleMessageListScroll,
    jumpToLatest,
  };
}
