import { useEffect, useRef, useState } from 'react';

import { formatDateOnly } from '@/lib/format';

interface DatePickerProps {
  // '' or 'YYYY-MM-DD', same value shape a native <input type="date"> used
  // — every call site already stores/sends dates in this format (see
  // dueDateMath.ts, formatDateOnly), so this is a drop-in replacement.
  value: string;
  onChange: (value: string) => void;
  // Full className for the trigger button, same as how each call site
  // already built its own className for the native input it's replacing —
  // filters (MessageLogsPage) and form fields (LoanForm,
  // RegisterPaymentDialog) use different heights/borders/colors, so this
  // component doesn't hardcode any of that itself.
  className: string;
  ariaLabel?: string;
  placeholder?: string;
}

interface CalendarCell {
  year: number;
  month: number;
  day: number;
  dateString: string;
  inCurrentMonth: boolean;
}

const WEEKDAY_LABELS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

function toDateString(year: number, month: number, day: number): string {
  return new Date(Date.UTC(year, month, day)).toISOString().slice(0, 10);
}

function parseDateString(
  value: string,
): { year: number; month: number; day: number } | null {
  if (!value) {
    return null;
  }
  const [year, month, day] = value.split('-').map(Number);
  return { year, month: month - 1, day };
}

// Always 42 cells (6 full weeks), Monday-first — the simplest way to get a
// visually stable grid height across months without special-casing 4/5/6
// week months. Built entirely with Date.UTC arithmetic (same approach as
// dueDateMath.ts) so month/year rollovers and leap years are handled by
// the JS Date engine itself, not hand-rolled clamping logic.
function buildCalendarGrid(year: number, month: number): CalendarCell[] {
  const firstWeekday = new Date(Date.UTC(year, month, 1)).getUTCDay();
  const mondayFirstOffset = (firstWeekday + 6) % 7;

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(Date.UTC(year, month, 1 - mondayFirstOffset + index));
    const cellYear = date.getUTCFullYear();
    const cellMonth = date.getUTCMonth();
    const cellDay = date.getUTCDate();
    return {
      year: cellYear,
      month: cellMonth,
      day: cellDay,
      dateString: toDateString(cellYear, cellMonth, cellDay),
      inCurrentMonth: cellMonth === month && cellYear === year,
    };
  });
}

function formatMonthYear(year: number, month: number): string {
  const label = new Date(Date.UTC(year, month, 1)).toLocaleDateString('es-CO', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

// Custom calendar replacing native <input type="date"> — same reasoning as
// components/ui/Select.tsx: the browser draws its own date picker popup
// (calendar grid, month navigation), which can't be restyled to match the
// app's dark theme. Shared across every date field in the app: Mensajes'
// Desde/Hasta filters, RegisterPaymentDialog's "Fecha de pago", and
// LoanForm's "Fecha de la primera cuota".
export function DatePicker({
  value,
  onChange,
  className,
  ariaLabel,
  placeholder = 'dd/mm/aaaa',
}: DatePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const parsedValue = parseDateString(value);
  const today = new Date();
  const [viewYear, setViewYear] = useState(
    parsedValue?.year ?? today.getFullYear(),
  );
  const [viewMonth, setViewMonth] = useState(
    parsedValue?.month ?? today.getMonth(),
  );

  // Jump the visible month back to the selected value whenever the picker
  // is (re)opened, rather than remembering wherever it was last navigated
  // to — matches how a native date input always opens on the selected date.
  useEffect(() => {
    if (isOpen) {
      const parsed = parseDateString(value);
      const now = new Date();
      setViewYear(parsed?.year ?? now.getFullYear());
      setViewMonth(parsed?.month ?? now.getMonth());
    }
  }, [isOpen, value]);

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

  const goToPreviousMonth = () => {
    const totalMonths = viewYear * 12 + viewMonth - 1;
    setViewYear(Math.floor(totalMonths / 12));
    setViewMonth(((totalMonths % 12) + 12) % 12);
  };

  const goToNextMonth = () => {
    const totalMonths = viewYear * 12 + viewMonth + 1;
    setViewYear(Math.floor(totalMonths / 12));
    setViewMonth(((totalMonths % 12) + 12) % 12);
  };

  const todayDateString = toDateString(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
  );
  const cells = buildCalendarGrid(viewYear, viewMonth);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((current) => !current)}
        className={`flex items-center justify-between gap-2 text-left focus:outline-none ${className}`}
      >
        <span className={value ? '' : 'text-mid'}>
          {value ? formatDateOnly(value) : placeholder}
        </span>
        <svg
          className="size-3.5 shrink-0 text-mid"
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
        >
          <rect x="3" y="4" width="14" height="13" rx="1.5" strokeWidth="1.5" />
          <path d="M3 8h14" strokeWidth="1.5" />
          <path d="M7 2.5v3M13 2.5v3" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute left-0 top-[calc(100%+4px)] z-10 w-[260px] rounded border border-border bg-input p-3 shadow-lg">
          <div className="flex items-center justify-between">
            <button
              type="button"
              aria-label="Mes anterior"
              onClick={goToPreviousMonth}
              className="flex size-6 items-center justify-center rounded text-muted hover:text-white"
            >
              ‹
            </button>
            <span className="text-small font-medium text-white">
              {formatMonthYear(viewYear, viewMonth)}
            </span>
            <button
              type="button"
              aria-label="Mes siguiente"
              onClick={goToNextMonth}
              className="flex size-6 items-center justify-center rounded text-muted hover:text-white"
            >
              ›
            </button>
          </div>

          <div className="mt-2.5 grid grid-cols-7 gap-y-1">
            {WEEKDAY_LABELS.map((label) => (
              <span
                key={label}
                className="flex h-6 items-center justify-center text-meta text-mid"
              >
                {label}
              </span>
            ))}
            {cells.map((cell) => {
              const isSelected = cell.dateString === value;
              const isToday = cell.dateString === todayDateString;
              return (
                <button
                  key={cell.dateString}
                  type="button"
                  onClick={() => {
                    onChange(cell.dateString);
                    setIsOpen(false);
                  }}
                  className={`flex size-7 items-center justify-center rounded text-small ${
                    isSelected
                      ? 'bg-white font-semibold text-background'
                      : cell.inCurrentMonth
                        ? `text-white hover:bg-border ${isToday ? 'border border-subtle' : ''}`
                        : 'text-mid hover:bg-border'
                  }`}
                >
                  {cell.day}
                </button>
              );
            })}
          </div>

          {value && (
            <button
              type="button"
              onClick={() => {
                onChange('');
                setIsOpen(false);
              }}
              className="mt-2.5 w-full rounded border border-border bg-surface py-1.5 text-meta text-muted hover:text-white"
            >
              Limpiar
            </button>
          )}
        </div>
      )}
    </div>
  );
}
