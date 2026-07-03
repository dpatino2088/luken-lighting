'use client';

import { useSyncExternalStore } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/Button';

interface ConfirmOptions {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
}

interface ConfirmState extends ConfirmOptions {
  id: number;
  resolve: (value: boolean) => void;
}

// ── Module-level store ─────────────────────────────────────────────────────────
let current: ConfirmState | null = null;
let nextId = 1;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}
function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}
function getSnapshot() {
  return current;
}
function getServerSnapshot(): ConfirmState | null {
  return null;
}

/**
 * Promise-based confirmation. Replaces the native window.confirm().
 *   if (!(await confirmDialog({ message, destructive: true }))) return;
 */
export function confirmDialog(options: ConfirmOptions | string): Promise<boolean> {
  const opts = typeof options === 'string' ? { message: options } : options;
  return new Promise((resolve) => {
    current = { id: nextId++, ...opts, resolve };
    emit();
  });
}

function close(result: boolean) {
  if (current) {
    current.resolve(result);
    current = null;
    emit();
  }
}

/** Mount once near the root of the admin layout. */
export function Confirmer() {
  const state = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  if (!state) return null;

  return (
    <div
      className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/40 p-4"
      onClick={() => close(false)}
    >
      <div
        className="w-full max-w-sm border border-gray-200 bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex gap-3 p-6">
          {state.destructive && (
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-500" />
          )}
          <div className="space-y-1.5">
            {state.title && (
              <h2 className="text-base font-semibold text-gray-900">{state.title}</h2>
            )}
            <p className="text-sm text-gray-600">{state.message}</p>
          </div>
        </div>
        <div className="flex justify-end gap-3 border-t border-gray-100 px-6 py-4">
          <Button type="button" variant="secondary" size="sm" onClick={() => close(false)}>
            {state.cancelLabel || 'Cancel'}
          </Button>
          <button
            type="button"
            onClick={() => close(true)}
            className={`inline-flex items-center px-4 py-2 text-xs font-medium uppercase tracking-wide text-white transition-colors ${
              state.destructive ? 'bg-red-600 hover:bg-red-700' : 'bg-gray-900 hover:bg-gray-800'
            }`}
          >
            {state.confirmLabel || 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  );
}
