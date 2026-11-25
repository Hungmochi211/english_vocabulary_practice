import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { Check, ChevronDown } from 'lucide-react';

export interface CustomSelectOption {
  value: string;
  label: string;
}

export interface CustomSelectProps {
  id?: string;
  ariaLabel?: string;
  value: string;
  options: CustomSelectOption[];
  onChange: (value: string) => void;
  size?: 'sm' | 'md';
  align?: 'left' | 'right';
  fullWidth?: boolean;
  className?: string;
}

export function CustomSelect({
  id,
  ariaLabel,
  value,
  options,
  onChange,
  size = 'sm',
  align = 'left',
  fullWidth = false,
  className = '',
}: CustomSelectProps) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState<number>(-1);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const listboxId = useId();

  const selectedIndex = Math.max(
    0,
    options.findIndex((opt) => opt.value === value),
  );
  const selectedOption = options[selectedIndex] ?? options[0];

  useEffect(() => {
    if (!open) return undefined;
    const handlePointerDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('pointerdown', handlePointerDown, true);
    return () => document.removeEventListener('pointerdown', handlePointerDown, true);
  }, [open]);

  function openMenu(initialIndex?: number) {
    setActiveIndex(initialIndex ?? selectedIndex);
    setOpen(true);
  }

  function selectOption(opt: CustomSelectOption) {
    onChange(opt.value);
    setOpen(false);
    triggerRef.current?.focus({ preventScroll: true });
  }

  function handleKeyDown(e: KeyboardEvent<HTMLButtonElement>) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!open) {
        openMenu(selectedIndex);
      } else {
        setActiveIndex((prev) => (prev + 1) % options.length);
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (!open) {
        openMenu(selectedIndex);
      } else {
        setActiveIndex((prev) => (prev - 1 + options.length) % options.length);
      }
    } else if (e.key === 'Home' && open) {
      e.preventDefault();
      setActiveIndex(0);
    } else if (e.key === 'End' && open) {
      e.preventDefault();
      setActiveIndex(options.length - 1);
    } else if ((e.key === 'Enter' || e.key === ' ') && open) {
      e.preventDefault();
      const target = options[activeIndex];
      if (target) selectOption(target);
    } else if (e.key === 'Escape' && open) {
      e.preventDefault();
      e.stopPropagation();
      setOpen(false);
    } else if (e.key === 'Tab' && open) {
      setOpen(false);
    }
  }

  const sizeClass =
    size === 'md'
      ? 'px-3.5 py-2.5 text-sm font-medium'
      : 'px-3 py-2 text-xs font-semibold';

  return (
    <div
      ref={rootRef}
      className={`relative ${fullWidth ? 'w-full' : 'inline-block'} ${className}`.trim()}
    >
      <button
        ref={triggerRef}
        id={id}
        type="button"
        role="combobox"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        onClick={() => (open ? setOpen(false) : openMenu())}
        onKeyDown={handleKeyDown}
        className={`flex items-center justify-between gap-2.5 rounded-xl border bg-white text-left text-slate-800 transition outline-none ${sizeClass} ${
          fullWidth ? 'w-full' : 'min-w-[140px]'
        } ${
          open
            ? 'border-indigo-500 ring-2 ring-indigo-100'
            : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50/70'
        }`}
      >
        <span className="truncate">{selectedOption?.label ?? ''}</span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-slate-400 transition-transform duration-200 ${
            open ? 'rotate-180 text-indigo-600' : ''
          }`}
          aria-hidden="true"
        />
      </button>

      {open && (
        <div
          id={listboxId}
          role="listbox"
          aria-label={ariaLabel}
          className={`lt-select-panel absolute z-50 mt-1.5 max-h-64 min-w-full overflow-y-auto rounded-2xl border border-slate-200 bg-white p-1.5 shadow-xl ${
            align === 'right' ? 'right-0' : 'left-0'
          }`}
        >
          {options.map((opt, idx) => {
            const isSelected = opt.value === value;
            const isActive = idx === activeIndex;
            return (
              <button
                key={`${opt.value}-${opt.label}`}
                type="button"
                role="option"
                aria-selected={isSelected}
                onMouseEnter={() => setActiveIndex(idx)}
                onClick={() => selectOption(opt)}
                className={`flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2 text-left text-xs transition ${
                  isSelected
                    ? 'bg-indigo-50 font-bold text-indigo-700'
                    : isActive
                      ? 'bg-slate-100 font-medium text-slate-900'
                      : 'font-medium text-slate-700 hover:bg-slate-50'
                }`}
              >
                <span className="whitespace-nowrap">{opt.label}</span>
                {isSelected && <Check className="h-3.5 w-3.5 shrink-0 text-indigo-600" aria-hidden="true" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
