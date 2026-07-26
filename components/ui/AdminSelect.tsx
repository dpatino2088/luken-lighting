'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

export type AdminSelectOption = {
  value: string;
  label: string;
  disabled?: boolean;
  /** Optional section header (optgroup-style). */
  group?: string | null;
};

/**
 * Luken admin dropdown — square borders, gray-900 selection, custom list panel.
 * Replaces native `<select>` so the open menu matches the project UI (not OS chrome).
 */
export function AdminSelect({
  value,
  onChange,
  options,
  placeholder = '— choose —',
  disabled = false,
  className,
  id,
  'aria-label': ariaLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  options: AdminSelectOption[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  id?: string;
  'aria-label'?: string;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const selected = options.find((o) => o.value === value);
  const display = selected?.label ?? (value || placeholder);

  // Preserve first-seen group order for section headers.
  const groups: { group: string | null; items: AdminSelectOption[] }[] = [];
  for (const opt of options) {
    const g = opt.group ?? null;
    let bucket = groups.find((b) => b.group === g);
    if (!bucket) {
      bucket = { group: g, items: [] };
      groups.push(bucket);
    }
    bucket.items.push(opt);
  }

  return (
    <div ref={rootRef} className={cn('relative', className)}>
      <button
        type="button"
        id={id}
        disabled={disabled}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => {
          if (!disabled) setOpen((v) => !v);
        }}
        className={cn(
          'w-full flex items-center justify-between gap-2 px-3 py-2 border border-gray-300 rounded-none bg-white text-sm text-left',
          'focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent',
          disabled
            ? 'bg-gray-100 text-gray-500 cursor-not-allowed'
            : 'text-gray-900 cursor-pointer hover:border-gray-400',
          !selected && !value && 'text-gray-400',
        )}
      >
        <span className="truncate">{display}</span>
        <ChevronDown
          className={cn(
            'h-4 w-4 shrink-0 text-gray-400 transition-transform',
            open && 'rotate-180',
          )}
        />
      </button>

      {open && !disabled && (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-50 mt-1 max-h-60 w-full overflow-auto border border-gray-300 bg-white shadow-lg py-1"
        >
          <li role="none">
            <button
              type="button"
              role="option"
              aria-selected={!value}
              className={cn(
                'w-full px-3 py-2 text-left text-sm transition-colors',
                !value ? 'bg-gray-900 text-white' : 'text-gray-500 hover:bg-gray-100',
              )}
              onClick={() => {
                onChange('');
                setOpen(false);
              }}
            >
              {placeholder}
            </button>
          </li>
          {groups.map((bucket, gi) => (
            <li key={gi} role="none">
              {bucket.group ? (
                <div className="px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                  {bucket.group}
                </div>
              ) : null}
              <ul role="group">
                {bucket.items.map((o) => {
                  const active = o.value === value;
                  return (
                    <li key={o.value} role="none">
                      <button
                        type="button"
                        role="option"
                        aria-selected={active}
                        disabled={o.disabled}
                        className={cn(
                          'w-full px-3 py-2 text-left text-sm transition-colors',
                          active
                            ? 'bg-gray-900 text-white'
                            : 'text-gray-900 hover:bg-gray-100',
                          o.disabled && 'opacity-40 cursor-not-allowed',
                        )}
                        onClick={() => {
                          if (o.disabled) return;
                          onChange(o.value);
                          setOpen(false);
                        }}
                      >
                        {o.label}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
