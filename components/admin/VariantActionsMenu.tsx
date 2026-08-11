'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  MoreHorizontal,
  Eye,
  Edit,
  Copy,
  Power,
  PowerOff,
  Trash2,
  Loader2,
} from 'lucide-react';
import {
  deleteVariant,
  duplicateVariant,
  setVariantActive,
} from '@/app/(admin)/admin/variants/actions';
import { toast } from '@/components/ui/Toast';
import { confirmDialog } from '@/components/ui/ConfirmDialog';

interface Props {
  variantId: string;
  variantCode: string;
  isActive: boolean;
  viewHref?: string;
  /** Compact icon trigger for table rows; otherwise labeled "Actions". */
  compact?: boolean;
}

export function VariantActionsMenu({
  variantId,
  variantCode,
  isActive,
  viewHref,
  compact = true,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [menuPos, setMenuPos] = useState<{ bottom: number; right: number } | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  // Always open upward, fixed to the viewport so table overflow cannot clip it.
  useEffect(() => {
    if (!open || !btnRef.current) {
      setMenuPos(null);
      return;
    }
    const place = () => {
      const r = btnRef.current!.getBoundingClientRect();
      setMenuPos({
        bottom: window.innerHeight - r.top + 4,
        right: window.innerWidth - r.right,
      });
    };
    place();
    window.addEventListener('scroll', place, true);
    window.addEventListener('resize', place);
    return () => {
      window.removeEventListener('scroll', place, true);
      window.removeEventListener('resize', place);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (rootRef.current?.contains(t) || menuRef.current?.contains(t)) return;
      setOpen(false);
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

  const run = (fn: () => Promise<void>) => {
    startTransition(async () => {
      await fn();
      setOpen(false);
    });
  };

  const handleDuplicate = () =>
    run(async () => {
      const ok = await confirmDialog({
        title: 'Duplicate variant',
        message: `Create a full copy of "${variantCode}" (specs, pricing, images, files)? The copy starts inactive so you can edit it before publishing.`,
        confirmLabel: 'Duplicate',
      });
      if (!ok) return;

      const result = await duplicateVariant(variantId);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(`Copied as "${result.code}".`);
      if (result.newVariantId) {
        router.push(`/admin/variants/${result.newVariantId}`);
        router.refresh();
      } else {
        router.refresh();
      }
    });

  const handleToggleActive = () =>
    run(async () => {
      const next = !isActive;
      const result = await setVariantActive(variantId, next);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(next ? `"${variantCode}" activated.` : `"${variantCode}" deactivated.`);
      router.refresh();
    });

  const handleDelete = () =>
    run(async () => {
      const ok = await confirmDialog({
        title: 'Delete variant',
        message: `Delete "${variantCode}"? This will also remove all associated files. This cannot be undone.`,
        confirmLabel: 'Delete',
        destructive: true,
      });
      if (!ok) return;

      const result = await deleteVariant(variantId);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(`"${variantCode}" deleted.`);
      router.push('/admin/variants');
      router.refresh();
    });

  const itemCls =
    'w-full flex items-center gap-2 px-3 py-2 text-xs text-left text-gray-700 hover:bg-gray-50 disabled:opacity-50';

  const menu =
    open && menuPos
      ? createPortal(
          <div
            ref={menuRef}
            role="menu"
            className="fixed z-50 w-48 bg-white border border-gray-200 shadow-lg py-1"
            style={{ bottom: menuPos.bottom, right: menuPos.right }}
          >
            {viewHref && viewHref !== '#' && (
              <Link
                href={viewHref}
                target="_blank"
                className={itemCls}
                onClick={() => setOpen(false)}
                role="menuitem"
              >
                <Eye className="w-3.5 h-3.5 text-gray-400" />
                View on site
              </Link>
            )}
            <Link
              href={`/admin/variants/${variantId}`}
              className={itemCls}
              onClick={() => setOpen(false)}
              role="menuitem"
            >
              <Edit className="w-3.5 h-3.5 text-gray-400" />
              Edit
            </Link>
            <button
              type="button"
              className={itemCls}
              onClick={handleDuplicate}
              disabled={pending}
              role="menuitem"
            >
              <Copy className="w-3.5 h-3.5 text-gray-400" />
              Duplicate
            </button>
            <button
              type="button"
              className={itemCls}
              onClick={handleToggleActive}
              disabled={pending}
              role="menuitem"
            >
              {isActive ? (
                <>
                  <PowerOff className="w-3.5 h-3.5 text-gray-400" />
                  Deactivate
                </>
              ) : (
                <>
                  <Power className="w-3.5 h-3.5 text-gray-400" />
                  Activate
                </>
              )}
            </button>
            <div className="my-1 border-t border-gray-100" />
            <button
              type="button"
              className={`${itemCls} text-red-600 hover:bg-red-50`}
              onClick={handleDelete}
              disabled={pending}
              role="menuitem"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Delete
            </button>
          </div>,
          document.body
        )
      : null;

  return (
    <div className="relative inline-block text-left" ref={rootRef}>
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={pending}
        className={
          compact
            ? 'p-1 text-gray-400 hover:text-gray-700 disabled:opacity-50'
            : 'inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium uppercase tracking-wide border border-gray-300 text-gray-700 hover:border-gray-900 disabled:opacity-50'
        }
        title="Actions"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        {pending ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : (
          <MoreHorizontal className="w-3.5 h-3.5" />
        )}
        {!compact && <span>Actions</span>}
      </button>
      {menu}
    </div>
  );
}
