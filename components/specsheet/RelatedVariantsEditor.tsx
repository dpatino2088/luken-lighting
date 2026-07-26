'use client';

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { componentFromType, SUBCATEGORY_OPTIONS, type ConfigRow } from '@/lib/sku/specSheet';
import { AdminSelect } from '@/components/ui/AdminSelect';

const fieldClass =
  'w-full px-3 py-2.5 border border-gray-300 rounded-none bg-white text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent disabled:bg-gray-100 disabled:text-gray-500';
const labelClass = 'block text-xs font-medium uppercase tracking-wide text-gray-500 mb-2';

/** Component dropdown = Type options (same list as Builder → Type). */
const COMPONENT_OPTIONS = SUBCATEGORY_OPTIONS;

type FamilyOption = { id: string; name: string };

type FamilyVariant = {
  id: string;
  code: string;
  name: string;
  short_description: string | null;
  mounting_type: string | null;
  subcategory: string;
};

/** Component = Type only. Empty when the related variant has no Type set. */
function suggestComponent(v: Pick<FamilyVariant, 'subcategory'>): string {
  return componentFromType(v.subcategory);
}

function rowFromVariant(v: FamilyVariant): ConfigRow {
  return {
    codigo: v.code || '',
    descripcion: (v.short_description || v.name || '').trim(),
    componente: suggestComponent(v),
  };
}

function isEmptyRow(r: ConfigRow) {
  return !r.codigo.trim() && !r.descripcion.trim() && !r.componente.trim();
}

/**
 * Related Variant: Family → popup with scrollable checkboxes → Add to sheet.
 */
export function RelatedVariantsEditor({
  products,
  currentProductId,
  currentVariantId,
  rows,
  onChange,
}: {
  products: FamilyOption[];
  currentProductId?: string | null;
  currentVariantId?: string | null;
  rows: ConfigRow[];
  onChange: (rows: ConfigRow[]) => void;
}) {
  const [familyId, setFamilyId] = useState(currentProductId || '');
  const [variants, setVariants] = useState<FamilyVariant[]>([]);
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
  const [pickerOpen, setPickerOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (currentProductId) setFamilyId(currentProductId);
  }, [currentProductId]);

  useEffect(() => {
    setCheckedIds(new Set());
  }, [familyId]);

  useEffect(() => {
    if (!pickerOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPickerOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [pickerOpen]);

  useEffect(() => {
    if (!familyId) {
      setVariants([]);
      setLoadError(null);
      return;
    }

    let cancelled = false;
    const supabase = createClient();
    if (!supabase) {
      setLoadError('Supabase not configured');
      setVariants([]);
      return;
    }

    setLoading(true);
    setLoadError(null);

    (async () => {
      const { data: pvData, error: pvError } = await supabase
        .from('product_variants')
        .select('id, code, name, short_description, mounting_type')
        .eq('product_id', familyId)
        .eq('is_active', true)
        .order('code');

      if (cancelled) return;
      if (pvError) {
        setLoadError(pvError.message);
        setVariants([]);
        setLoading(false);
        return;
      }

      const list = (pvData || []).filter((v) => v.id !== currentVariantId);
      const ids = list.map((v) => v.id);
      const subById = new Map<string, string>();

      if (ids.length > 0) {
        // Latest sheet per variant wins (Type lives in data.subcategory).
        const { data: sheets } = await supabase
          .from('spec_sheets')
          .select('variant_id, data, updated_at')
          .in('variant_id', ids)
          .is('deleted_at', null)
          .order('updated_at', { ascending: false });
        if (!cancelled && sheets) {
          for (const s of sheets) {
            if (!s.variant_id || subById.has(s.variant_id)) continue;
            const sub = (s.data as { subcategory?: string } | null)?.subcategory;
            if (sub?.trim()) subById.set(s.variant_id, sub.trim());
          }
        }
      }

      if (cancelled) return;
      setVariants(
        list.map((v) => ({
          ...v,
          short_description: v.short_description ?? null,
          mounting_type: v.mounting_type ?? null,
          subcategory: subById.get(v.id) || '',
        }))
      );
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [familyId, currentVariantId]);

  const onSheetCodes = useMemo(
    () => new Set(rows.map((r) => r.codigo.trim()).filter(Boolean)),
    [rows]
  );

  const available = useMemo(
    () => variants.filter((v) => !onSheetCodes.has(v.code)),
    [variants, onSheetCodes]
  );

  const familyName = products.find((p) => p.id === familyId)?.name;
  const allAvailableChecked =
    available.length > 0 && available.every((v) => checkedIds.has(v.id));
  const pendingCount = available.filter((v) => checkedIds.has(v.id)).length;

  const openPicker = () => {
    if (!familyId || available.length === 0) return;
    setCheckedIds(new Set());
    setPickerOpen(true);
  };

  const toggleOne = (id: string, next: boolean) => {
    setCheckedIds((prev) => {
      const copy = new Set(prev);
      if (next) copy.add(id);
      else copy.delete(id);
      return copy;
    });
  };

  const toggleAll = (next: boolean) => {
    if (!next) {
      setCheckedIds(new Set());
      return;
    }
    setCheckedIds(new Set(available.map((v) => v.id)));
  };

  const handleAddFromPicker = () => {
    const toAdd = available.filter((v) => checkedIds.has(v.id)).map(rowFromVariant);
    if (toAdd.length === 0) return;

    const kept = rows.filter((r) => !isEmptyRow(r));
    onChange(kept.length ? [...kept, ...toAdd] : toAdd);
    setCheckedIds(new Set());
    setPickerOpen(false);
  };

  const updateRow = (i: number, patch: Partial<ConfigRow>) => {
    onChange(rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  };

  const removeRow = (i: number) => {
    const next = rows.filter((_, idx) => idx !== i);
    onChange(next.length ? next : [{ codigo: '', descripcion: '', componente: '' }]);
  };

  const sheetRows = rows.filter((r) => !isEmptyRow(r));

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h3 className="text-sm font-semibold uppercase tracking-wide">Related Variant</h3>
        <p className="text-[11px] text-gray-500 max-w-xl leading-relaxed">
          Choose a family, open the variant list, check what you need, then add them to the sheet.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl">
        <div>
          <label className={labelClass}>Family</label>
          <AdminSelect
            aria-label="Family"
            value={familyId}
            placeholder="— choose family —"
            onChange={setFamilyId}
            options={products.map((p) => ({ value: p.id, label: p.name }))}
          />
        </div>

        <div className="flex flex-col justify-end">
          <label className={labelClass}>Variants</label>
          <button
            type="button"
            onClick={openPicker}
            disabled={!familyId || loading || available.length === 0}
            className="w-full border border-gray-900 bg-white px-4 py-2.5 text-sm font-medium text-gray-900 hover:bg-gray-900 hover:text-white transition-colors disabled:border-gray-200 disabled:bg-gray-50 disabled:text-gray-400 disabled:cursor-not-allowed"
          >
            {loading
              ? 'Loading variants…'
              : !familyId
                ? 'Choose a family first'
                : available.length === 0
                  ? 'No variants left to add'
                  : `Browse variants… (${available.length})`}
          </button>
          {loadError && <p className="mt-2 text-[11px] text-red-600">{loadError}</p>}
        </div>
      </div>

      {/* On sheet */}
      <div className="space-y-4 pt-2 border-t border-gray-100">
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
            On sheet (preview)
          </p>
          {sheetRows.length > 0 && (
            <p className="text-[11px] text-gray-400">{sheetRows.length} related</p>
          )}
        </div>

        {sheetRows.length === 0 ? (
          <p className="text-[11px] text-gray-400 italic py-2">
            Nothing on the sheet yet — browse variants and press Add.
          </p>
        ) : (
          <div className="space-y-4">
            {rows.map((c, i) =>
              isEmptyRow(c) ? null : (
                <div key={`${c.codigo}-${i}`} className="flex items-end gap-3">
                  <div className="grid flex-1 grid-cols-1 sm:grid-cols-3 gap-4">
                    <input
                      className={`${fieldClass} bg-gray-50 font-mono`}
                      placeholder="Code"
                      value={c.codigo}
                      readOnly
                      tabIndex={-1}
                    />
                    <input
                      className={fieldClass}
                      placeholder="Description"
                      value={c.descripcion}
                      onChange={(e) => updateRow(i, { descripcion: e.target.value })}
                    />
                    <AdminSelect
                      aria-label="Type / Component"
                      value={c.componente}
                      placeholder="— Type / Component —"
                      onChange={(v) => updateRow(i, { componente: v })}
                      options={[
                        ...(c.componente &&
                        !(COMPONENT_OPTIONS as readonly string[]).includes(
                          c.componente as (typeof COMPONENT_OPTIONS)[number],
                        )
                          ? [{ value: c.componente, label: c.componente }]
                          : []),
                        ...COMPONENT_OPTIONS.map((opt) => ({ value: opt, label: opt })),
                      ]}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => removeRow(i)}
                    className="mb-0.5 shrink-0 border border-red-200 bg-red-50 px-3 py-2.5 text-[11px] text-red-600 hover:border-red-300"
                  >
                    Remove
                  </button>
                </div>
              )
            )}
          </div>
        )}
      </div>

      {/* Popup picker */}
      {pickerOpen && (
        <div
          className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/40 p-4 sm:p-8"
          onClick={() => setPickerOpen(false)}
        >
          <div
            className="flex w-full max-w-xl max-h-[min(80vh,640px)] flex-col border border-gray-200 bg-white shadow-xl"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="related-variant-picker-title"
          >
            <div className="shrink-0 border-b border-gray-200 px-6 py-5 space-y-1">
              <h2
                id="related-variant-picker-title"
                className="text-base font-semibold text-gray-900"
              >
                Select variants
              </h2>
              <p className="text-[12px] text-gray-500">
                {familyName ? (
                  <>
                    Family <strong className="font-medium text-gray-700">{familyName}</strong>
                    {' · '}
                  </>
                ) : null}
                Check the ones to add to this sheet.
              </p>
            </div>

            <div className="shrink-0 flex items-center justify-between gap-3 border-b border-gray-100 bg-gray-50 px-6 py-3">
              <label className="inline-flex items-center gap-2.5 text-sm text-gray-800 cursor-pointer">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded-none border-gray-300 text-gray-900 focus:ring-gray-900"
                  checked={allAvailableChecked}
                  onChange={(e) => toggleAll(e.target.checked)}
                />
                Select all
              </label>
              <span className="text-[11px] text-gray-400">
                {pendingCount} of {available.length} selected
              </span>
            </div>

            <ul className="min-h-0 flex-1 overflow-y-auto divide-y divide-gray-100">
              {available.map((v) => {
                const checked = checkedIds.has(v.id);
                const hint = suggestComponent(v);
                return (
                  <li key={v.id}>
                    <label className="flex items-start gap-3.5 px-6 py-3.5 cursor-pointer hover:bg-gray-50">
                      <input
                        type="checkbox"
                        className="mt-0.5 h-4 w-4 shrink-0 rounded-none border-gray-300 text-gray-900 focus:ring-gray-900"
                        checked={checked}
                        onChange={(e) => toggleOne(v.id, e.target.checked)}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block font-mono text-sm text-gray-900">{v.code}</span>
                        <span className="mt-0.5 block text-[12px] text-gray-500 leading-snug">
                          {v.short_description || v.name}
                        </span>
                      </span>
                      <span className="shrink-0 pt-0.5 text-[10px] uppercase tracking-wide text-gray-400">
                        {hint || 'No Type'}
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>

            <div className="shrink-0 flex items-center justify-end gap-3 border-t border-gray-200 px-6 py-4">
              <button
                type="button"
                onClick={() => setPickerOpen(false)}
                className="border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:border-gray-400"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAddFromPicker}
                disabled={pendingCount === 0}
                className="bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                + Add{pendingCount > 0 ? ` (${pendingCount})` : ''}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
