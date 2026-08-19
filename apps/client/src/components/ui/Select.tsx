import { useEffect, useRef, useState } from 'react';

export interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  className?: string;
  // Shown in place of a label when no option is selected — same role as
  // a native <select>'s disabled first option, or DatePicker.tsx's own
  // `placeholder` prop. Without this, an unselected required Select (e.g.
  // ClientForm's "Tipo de documento") just renders blank, which reads as
  // broken rather than empty-and-required.
  placeholder?: string;
}

// Replaces a native <select> — the browser draws a native <select>'s
// option list itself (OS chrome, not CSS-stylable to match the app's dark
// theme consistently across browsers), which is why "Todos los estados"
// looked out of place next to everything else. This rebuilds the same
// value/onChange behavior with app-styled markup instead. Shared between
// LoansListPage.tsx and MessageLogsPage.tsx's "Estado" filters (and any
// future dropdown filter — reuse this rather than another native <select>).
export function Select({
  value,
  onChange,
  options,
  className = '',
  placeholder,
}: SelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selected = options.find((option) => option.value === value);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };
    const handleClickOutside = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((current) => !current)}
        className="flex h-[38px] w-full items-center justify-between gap-2 rounded bg-input px-3 text-small text-muted focus:outline-none"
      >
        <span className="truncate">{selected?.label ?? placeholder ?? ''}</span>
        <svg
          className={`size-3 shrink-0 text-muted transition-transform ${isOpen ? 'rotate-180' : ''}`}
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
        >
          <path
            d="M5 7.5l5 5 5-5"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {isOpen && (
        <div
          role="listbox"
          className="absolute left-0 top-[calc(100%+4px)] z-10 w-full min-w-max overflow-hidden rounded border border-border bg-input shadow-lg"
        >
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              role="option"
              aria-selected={option.value === value}
              onClick={() => {
                onChange(option.value);
                setIsOpen(false);
              }}
              className={`block w-full px-3 py-2 text-left text-small ${
                option.value === value
                  ? 'bg-border font-medium text-white'
                  : 'text-muted hover:bg-border hover:text-white'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
