'use client';

import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, X } from 'lucide-react';
import {
  listManufacturers,
  createManufacturer,
  updateManufacturer,
  deleteManufacturer,
} from '@/app/(admin)/admin/manufacturers/actions';
import { confirmDialog } from '@/components/ui/ConfirmDialog';
import { toast } from '@/components/ui/Toast';
import type { Manufacturer } from '@/lib/types';

const CURRENCIES = ['USD', 'EUR', 'CNY', 'GBP', 'MXN', 'CAD', 'BRL', 'COP', 'JPY'];

const selectClass =
  'w-full px-3 py-2 border border-gray-300 rounded-none bg-white text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent';
const inputClass = selectClass;
const labelClass = 'block text-xs font-medium uppercase tracking-wide text-gray-500 mb-1';
const iconBtn =
  'p-2 border border-gray-300 text-gray-500 hover:text-gray-900 hover:border-gray-400 disabled:opacity-40 disabled:cursor-not-allowed transition-colors';

interface Props {
  /** Current manufacturer name (stored as text on the variant). */
  value: string;
  onChange: (name: string) => void;
  /** When set, also renders a hidden input so it works inside a <form> (FormData). */
  name?: string;
}

export function ManufacturerSelect({ value, onChange, name }: Props) {
  const [list, setList] = useState<Manufacturer[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [mode, setMode] = useState<'create' | 'edit'>('create');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [fName, setFName] = useState('');
  const [fCountry, setFCountry] = useState('');
  const [fCurrency, setFCurrency] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    listManufacturers().then((res) => {
      if (res.manufacturers) setList(res.manufacturers);
    });
  }, []);

  const selected = list.find((m) => m.name === value) || null;

  const openCreate = () => {
    setMode('create');
    setEditingId(null);
    setFName('');
    setFCountry('');
    setFCurrency('');
    setError('');
    setModalOpen(true);
  };

  const openEdit = () => {
    if (!selected) return;
    setMode('edit');
    setEditingId(selected.id);
    setFName(selected.name);
    setFCountry(selected.country || '');
    setFCurrency(selected.currency || '');
    setError('');
    setModalOpen(true);
  };

  const handleSave = async () => {
    const trimmed = fName.trim();
    if (!trimmed) {
      setError('Name is required');
      return;
    }
    setSaving(true);
    setError('');

    if (mode === 'create') {
      const res = await createManufacturer({ name: trimmed, country: fCountry, currency: fCurrency });
      if (res.error) {
        setError(res.error);
        setSaving(false);
        return;
      }
      if (res.manufacturer) {
        setList((prev) => [...prev, res.manufacturer as Manufacturer].sort((a, b) => a.name.localeCompare(b.name)));
        onChange(res.manufacturer.name);
      }
    } else if (editingId) {
      const res = await updateManufacturer(editingId, { name: trimmed, country: fCountry, currency: fCurrency });
      if (res.error) {
        setError(res.error);
        setSaving(false);
        return;
      }
      if (res.manufacturer) {
        const updated = res.manufacturer as Manufacturer;
        setList((prev) =>
          prev.map((m) => (m.id === updated.id ? updated : m)).sort((a, b) => a.name.localeCompare(b.name)),
        );
        // If the currently selected one was renamed, keep it selected.
        if (selected?.id === updated.id) onChange(updated.name);
      }
    }

    setSaving(false);
    setModalOpen(false);
  };

  const handleDelete = async () => {
    if (!selected) return;
    const ok = await confirmDialog({
      title: 'Delete manufacturer',
      message: `Delete manufacturer "${selected.name}" from the list? Variants that already use it keep the name.`,
      confirmLabel: 'Delete',
      destructive: true,
    });
    if (!ok) return;
    const res = await deleteManufacturer(selected.id);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    setList((prev) => prev.filter((m) => m.id !== selected.id));
    onChange('');
    toast.success(`Manufacturer "${selected.name}" deleted.`);
  };

  return (
    <div>
      {name ? <input type="hidden" name={name} value={value} /> : null}
      <div className="flex items-center gap-2">
        <select
          className={selectClass}
          value={selected ? value : ''}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="">— Select manufacturer —</option>
          {value && !selected && <option value={value}>{value} (not in list)</option>}
          {list.map((m) => (
            <option key={m.id} value={m.name}>
              {m.name}
              {m.country ? ` · ${m.country}` : ''}
              {m.currency ? ` · ${m.currency}` : ''}
            </option>
          ))}
        </select>
        <button type="button" onClick={openCreate} className={iconBtn} title="Add new manufacturer">
          <Plus className="w-4 h-4" />
        </button>
        <button type="button" onClick={openEdit} disabled={!selected} className={iconBtn} title="Edit selected">
          <Pencil className="w-4 h-4" />
        </button>
        <button type="button" onClick={handleDelete} disabled={!selected} className={iconBtn} title="Delete selected">
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setModalOpen(false)}>
          <div
            className="w-full max-w-md bg-white border border-gray-200 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-gray-200 px-5 py-3">
              <h3 className="text-sm font-medium uppercase tracking-wide">
                {mode === 'create' ? 'New manufacturer' : 'Edit manufacturer'}
              </h3>
              <button type="button" onClick={() => setModalOpen(false)} className="text-gray-400 hover:text-gray-700">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              {error && <div className="p-2 bg-red-50 border border-red-200 text-red-800 text-xs">{error}</div>}
              <div>
                <label className={labelClass}>Name *</label>
                <input
                  className={inputClass}
                  value={fName}
                  onChange={(e) => setFName(e.target.value)}
                  placeholder="e.g. iGuzzini"
                  autoFocus
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Country of origin</label>
                  <input
                    className={inputClass}
                    value={fCountry}
                    onChange={(e) => setFCountry(e.target.value)}
                    placeholder="e.g. Italy"
                  />
                </div>
                <div>
                  <label className={labelClass}>Currency</label>
                  <select className={selectClass} value={fCurrency} onChange={(e) => setFCurrency(e.target.value)}>
                    <option value="">—</option>
                    {CURRENCIES.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t border-gray-200 px-5 py-3">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="px-4 py-2 text-sm border border-gray-300 text-gray-600 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving || !fName.trim()}
                className="px-4 py-2 text-sm bg-gray-900 text-white hover:bg-gray-800 disabled:opacity-50"
              >
                {saving ? 'Saving…' : mode === 'create' ? 'Create' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
