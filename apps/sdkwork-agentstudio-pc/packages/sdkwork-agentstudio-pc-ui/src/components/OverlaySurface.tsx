import React, { type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import { cn } from '../lib/utils';
import {
  getOverlayContainerClassName,
  getOverlayContainerStyle,
  getOverlaySurfaceStyle,
  type OverlayDrawerSide,
  type OverlayModalAlignment,
  type OverlayVariant,
} from './overlayLayout';

export type { OverlayDrawerSide, OverlayModalAlignment, OverlayVariant } from './overlayLayout';

export interface OverlaySurfaceProps {
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
  variant?: OverlayVariant;
  modalAlignment?: OverlayModalAlignment;
  drawerSide?: OverlayDrawerSide;
  closeOnBackdrop?: boolean;
  closeOnEscape?: boolean;
  className?: string;
  backdropClassName?: string;
}

function getSurfaceMotion(variant: OverlayVariant, drawerSide: OverlayDrawerSide) {
  if (variant === 'drawer') {
    const delta = drawerSide === 'left' ? -28 : 28;
    return {
      initial: { opacity: 0, x: delta },
      animate: { opacity: 1, x: 0 },
      exit: { opacity: 0, x: delta },
    };
  }

  return {
    initial: { opacity: 0, scale: 0.96, y: 24 },
    animate: { opacity: 1, scale: 1, y: 0 },
    exit: { opacity: 0, scale: 0.96, y: 24 },
  };
}

export function OverlaySurface({
  isOpen,
  onClose,
  children,
  variant = 'modal',
  modalAlignment = 'center',
  drawerSide = 'right',
  closeOnBackdrop = true,
  closeOnEscape = true,
  className,
  backdropClassName,
}: OverlaySurfaceProps) {
  const surfaceMotion = getSurfaceMotion(variant, drawerSide);

  React.useEffect(() => {
    if (!isOpen || !closeOnEscape || typeof window === 'undefined') {
      return;
    }

    const handleWindowKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleWindowKeyDown);
    return () => {
      window.removeEventListener('keydown', handleWindowKeyDown);
    };
  }, [closeOnEscape, isOpen, onClose]);

  if (typeof document === 'undefined') {
    return null;
  }

  return createPortal(
    <AnimatePresence>
      {isOpen ? (
        <div className="fixed inset-0 z-[120]">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            data-slot="overlay-backdrop"
            className={cn(
              'absolute inset-0 bg-zinc-950/45 backdrop-blur-sm',
              backdropClassName,
            )}
          />
          <div
            className={cn(
              'relative flex h-full',
              getOverlayContainerClassName(variant, modalAlignment, drawerSide),
            )}
            style={getOverlayContainerStyle()}
            onClick={closeOnBackdrop ? onClose : undefined}
          >
            <motion.div
              {...surfaceMotion}
              transition={{
                type: 'spring',
                stiffness: 360,
                damping: 28,
                mass: 0.82,
              }}
              style={variant === 'drawer' ? undefined : getOverlaySurfaceStyle()}
              data-slot={`overlay-surface-${variant}`}
              className={cn(
                'relative flex w-full flex-col overflow-hidden border border-zinc-200/80 bg-white shadow-2xl shadow-zinc-950/12 dark:border-zinc-800 dark:bg-zinc-900',
                variant === 'drawer'
                  ? 'max-w-xl self-stretch rounded-[20px]'
                  : 'max-w-md rounded-[20px]',
                className,
              )}
              onClick={(event) => event.stopPropagation()}
            >
              {children}
            </motion.div>
          </div>
        </div>
      ) : null}
    </AnimatePresence>,
    document.body,
  );
}
