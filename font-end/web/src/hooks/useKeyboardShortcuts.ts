import { useEffect } from 'react';

export interface ShortcutHandlers {
  onQuickSearch?: () => void;
  onEscape?: () => void;
  onSpace?: () => void;
  onEnter?: () => void;
  onDigit?: (digit: 1 | 2 | 3 | 4) => void;
  enabled?: boolean;
}

export function useKeyboardShortcuts({
  onQuickSearch,
  onEscape,
  onSpace,
  onEnter,
  onDigit,
  enabled = true,
}: ShortcutHandlers): void {
  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName ?? '';
      const isEditable = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || Boolean(target?.isContentEditable);
      const allowsQuizShortcut = Boolean(target?.closest('[data-allow-enter-shortcut="true"]'));
      const isInteractiveControl =
        tag === 'BUTTON' || tag === 'A' || tag === 'SUMMARY' || Boolean(target?.closest('button, a, [role="button"]'));
      const isInsideDialog = Boolean(target?.closest('[role="dialog"], [aria-modal="true"]'));
      const isMenuOrListboxOpen =
        Boolean(target?.closest('[role="menu"], [role="listbox"]')) ||
        Boolean(document.querySelector('[role="listbox"], .acct-menu.is-open [role="menu"]'));

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k' && onQuickSearch) {
        event.preventDefault();
        onQuickSearch();
        return;
      }

      if (event.key === 'Escape' && onEscape) {
        onEscape();
        return;
      }

      if (isEditable || isInsideDialog || isMenuOrListboxOpen) return;

      if (event.code === 'Space' && onSpace && !isInteractiveControl) {
        event.preventDefault();
        onSpace();
        return;
      }

      if (event.key === 'Enter' && onEnter && (!isInteractiveControl || allowsQuizShortcut)) {
        event.preventDefault();
        onEnter();
        return;
      }

      if (
        onDigit &&
        ['1', '2', '3', '4'].includes(event.key) &&
        (!isInteractiveControl || allowsQuizShortcut)
      ) {
        onDigit(Number(event.key) as 1 | 2 | 3 | 4);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [enabled, onDigit, onEnter, onEscape, onQuickSearch, onSpace]);
}
