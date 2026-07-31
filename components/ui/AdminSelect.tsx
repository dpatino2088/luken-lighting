'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';
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
/** As tall as the list may be when the room is there. About six rows. */
const PANEL_MAX = 240;

/** Below this there is no list worth opening, so it goes the other way instead. */
const PANEL_MIN = 132;

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
  const listRef = useRef<HTMLUListElement>(null);
  const chosenRef = useRef<HTMLButtonElement>(null);
  const listId = useId();

  /**
   * Where the list can actually be read, and how much of it fits.
   *
   * A field near the foot of the window has nothing below it, and a panel opened
   * down there is cut off by the edge of the screen — with a long list, such as the
   * 21 product types, the options at the bottom cannot be reached at all. So the
   * room is measured and the list opens into whichever side has more of it, never
   * taller than what is left.
   */
  const [panel, setPanel] = useState<{ up: boolean; max: number }>({ up: false, max: PANEL_MAX });
  const [query, setQuery] = useState('');

  // Every opening starts from the whole list.
  useEffect(() => {
    if (!open) setQuery('');
  }, [open]);

  // Measured as the list opens rather than after it, so it never appears in the
  // wrong place first and then corrects itself.
  const measure = useCallback(() => {
    const field = rootRef.current?.getBoundingClientRect();
    if (!field) return;
    const edge = 8;
    const below = window.innerHeight - field.bottom - edge;
    const above = field.top - edge;
    // Downwards is the habit, so it stays that way unless it is genuinely short of
    // room and turning round buys something.
    const up = below < Math.min(PANEL_MAX, above) && below < PANEL_MIN;
    setPanel({ up, max: Math.max(PANEL_MIN, Math.min(PANEL_MAX, up ? above : below)) });
  }, []);

  useEffect(() => {
    if (!open) return;
    window.addEventListener('resize', measure);
    // Capture: the field may sit inside a scrolling panel rather than the page.
    window.addEventListener('scroll', measure, true);
    return () => {
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
    };
  }, [open, measure]);

  // A list of 21 opened on the twentieth should not start at the first. Only the
  // list is scrolled: `scrollIntoView` would take the page with it, so opening a
  // dropdown would shift the form under the cursor.
  useEffect(() => {
    if (!open) return;
    const list = listRef.current;
    const chosen = chosenRef.current;
    if (!list || !chosen) return;
    list.scrollTop = Math.max(0, chosen.offsetTop - (list.clientHeight - chosen.offsetHeight) / 2);
  }, [open]);

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

  /**
   * Long lists get a line to type in.
   *
   * Six rows of a twenty-one-item list is a list that looks finished at
   * "General Lighting", and on a Mac the scrollbar only appears once you are already
   * scrolling — so the options at the end read as missing rather than as further
   * down. Typing three letters is also simply the quickest way to reach one.
   */
  const searchable = options.length > 8;
  const needle = query.trim().toLowerCase();
  const shown =
    searchable && needle
      ? options.filter(
          (o) =>
            o.label.toLowerCase().includes(needle) || o.value.toLowerCase().includes(needle)
        )
      : options;

  // Preserve first-seen group order for section headers.
  const groups: { group: string | null; items: AdminSelectOption[] }[] = [];
  for (const opt of shown) {
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
          if (disabled) return;
          if (!open) measure();
          setOpen((v) => !v);
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
          ref={listRef}
          id={listId}
          role="listbox"
          style={{ maxHeight: panel.max }}
          className={cn(
            'absolute z-50 w-full overflow-auto border border-gray-300 bg-white shadow-lg py-1',
            panel.up ? 'bottom-full mb-1' : 'top-full mt-1',
          )}
        >
          {searchable && (
            <li role="none" className="sticky top-0 z-10 bg-white px-2 pb-1">
              <input
                // The list is open because somebody is looking for an option, so the
                // line they can type it into is where the cursor belongs.
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key !== 'Enter') return;
                  e.preventDefault();
                  const first = shown.find((o) => !o.disabled);
                  if (!first) return;
                  onChange(first.value);
                  setOpen(false);
                }}
                placeholder="Type to filter…"
                aria-label="Filter options"
                className="w-full border border-gray-200 px-2 py-1.5 text-sm focus:border-gray-400 focus:outline-none"
              />
            </li>
          )}
          {!needle && (
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
          )}
          {shown.length === 0 && (
            <li role="none" className="px-3 py-2 text-sm text-gray-400">
              Nothing here matches “{query.trim()}”.
            </li>
          )}
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
                        ref={active ? chosenRef : undefined}
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
