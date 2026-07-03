'use client';

import { useState } from 'react';
import { Plus, Pencil, Trash2, X, Check, GripVertical } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  createCategory,
  updateCategory,
  deleteCategory,
  updateCategorySortOrder,
} from '@/app/(admin)/admin/categories/actions';
import { confirmDialog } from '@/components/ui/ConfirmDialog';
import { toast } from '@/components/ui/Toast';
import type { ProductCategory } from '@/lib/types';

interface Props {
  initialCategories: ProductCategory[];
}

function SortableRow({
  cat,
  isEditing,
  onStartEdit,
  onDelete,
  editState,
}: {
  cat: ProductCategory;
  isEditing: boolean;
  onStartEdit: () => void;
  onDelete: () => void;
  editState?: React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: cat.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : undefined,
    opacity: isDragging ? 0.5 : 1,
  };

  if (isEditing && editState) {
    return (
      <div ref={setNodeRef} style={style} className="grid grid-cols-12 gap-4 px-4 py-3 border-b border-gray-200 items-center bg-blue-50">
        <div className="col-span-1 flex justify-center">
          <GripVertical className="w-4 h-4 text-gray-300" />
        </div>
        {editState}
      </div>
    );
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="grid grid-cols-12 gap-4 px-4 py-3 border-b border-gray-200 items-center hover:bg-gray-50 transition-colors"
    >
      <div className="col-span-1 flex justify-center">
        <button {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing p-1 text-gray-400 hover:text-gray-600 touch-none">
          <GripVertical className="w-4 h-4" />
        </button>
      </div>
      <div className="col-span-3 text-sm font-medium">{cat.name}</div>
      <div className="col-span-2 text-sm text-gray-500">{cat.slug}</div>
      <div className="col-span-4 text-sm text-gray-500 truncate">{cat.description || '—'}</div>
      <div className="col-span-2 flex justify-end gap-1">
        <button onClick={onStartEdit} className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors" title="Edit">
          <Pencil className="w-4 h-4" />
        </button>
        <button onClick={onDelete} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors" title="Delete">
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

export function CategoriesManager({ initialCategories }: Props) {
  const [categories, setCategories] = useState(initialCategories);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const [editName, setEditName] = useState('');
  const [editSlug, setEditSlug] = useState('');
  const [editDescription, setEditDescription] = useState('');

  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const startEdit = (cat: ProductCategory) => {
    setEditingId(cat.id);
    setEditName(cat.name);
    setEditSlug(cat.slug);
    setEditDescription(cat.description || '');
    setShowCreate(false);
    setError('');
  };

  const cancelEdit = () => { setEditingId(null); setError(''); };

  const handleUpdate = async () => {
    if (!editingId || !editName.trim()) return;
    setSaving(true);
    setError('');
    const fd = new FormData();
    fd.set('name', editName.trim());
    fd.set('slug', editSlug.trim());
    fd.set('description', editDescription.trim());
    const result = await updateCategory(editingId, fd);
    if (result.error) { setError(result.error); }
    else {
      setCategories((prev) =>
        prev.map((c) => c.id === editingId ? { ...c, name: editName.trim(), slug: editSlug.trim(), description: editDescription.trim() || null } : c)
      );
      setEditingId(null);
    }
    setSaving(false);
  };

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setSaving(true);
    setError('');
    const fd = new FormData();
    fd.set('name', newName.trim());
    fd.set('description', newDescription.trim());
    const result = await createCategory(fd);
    if (result.error) { setError(result.error); }
    else if (result.category) {
      setCategories((prev) => [...prev, result.category as ProductCategory]);
      setNewName(''); setNewDescription(''); setShowCreate(false);
    }
    setSaving(false);
  };

  const handleDelete = async (cat: ProductCategory) => {
    const ok = await confirmDialog({
      title: 'Delete category',
      message: `Delete category "${cat.name}"? This cannot be undone.`,
      confirmLabel: 'Delete',
      destructive: true,
    });
    if (!ok) return;
    const result = await deleteCategory(cat.id);
    if (result.error) {
      toast.error(result.error);
    } else {
      setCategories((prev) => prev.filter((c) => c.id !== cat.id));
      toast.success(`Category "${cat.name}" deleted.`);
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = categories.findIndex((c) => c.id === active.id);
    const newIndex = categories.findIndex((c) => c.id === over.id);
    const reordered = arrayMove(categories, oldIndex, newIndex);
    setCategories(reordered);
    await updateCategorySortOrder(reordered.map((c) => c.id));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-light tracking-widest uppercase mb-2">Categories</h1>
          <p className="text-gray-600">Manage product categories</p>
        </div>
        {!showCreate && (
          <Button type="button" variant="primary" onClick={() => { setShowCreate(true); setEditingId(null); setError(''); }}>
            <Plus className="w-4 h-4 mr-2" />
            Add Category
          </Button>
        )}
      </div>

      {error && <div className="p-3 bg-red-50 border border-red-200 text-red-800 text-sm">{error}</div>}

      <div className="border border-gray-200 bg-white">
        <div className="grid grid-cols-12 gap-4 px-4 py-3 bg-gray-50 border-b border-gray-200 text-xs font-medium text-gray-500 uppercase tracking-wide">
          <div className="col-span-1"></div>
          <div className="col-span-3">Name</div>
          <div className="col-span-2">Slug</div>
          <div className="col-span-4">Description</div>
          <div className="col-span-2 text-right">Actions</div>
        </div>

        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={categories.map((c) => c.id)} strategy={verticalListSortingStrategy}>
            {categories.map((cat) => (
              <SortableRow
                key={cat.id}
                cat={cat}
                isEditing={editingId === cat.id}
                onStartEdit={() => startEdit(cat)}
                onDelete={() => handleDelete(cat)}
                editState={
                  editingId === cat.id ? (
                    <>
                      <div className="col-span-3">
                        <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)} className="w-full px-2 py-1.5 text-sm border border-gray-300 focus:outline-none focus:ring-1 focus:ring-gray-900" />
                      </div>
                      <div className="col-span-2">
                        <input type="text" value={editSlug} onChange={(e) => setEditSlug(e.target.value)} className="w-full px-2 py-1.5 text-sm border border-gray-300 focus:outline-none focus:ring-1 focus:ring-gray-900" />
                      </div>
                      <div className="col-span-4">
                        <input type="text" value={editDescription} onChange={(e) => setEditDescription(e.target.value)} className="w-full px-2 py-1.5 text-sm border border-gray-300 focus:outline-none focus:ring-1 focus:ring-gray-900" />
                      </div>
                      <div className="col-span-2 flex justify-end gap-1">
                        <button onClick={handleUpdate} disabled={saving} className="p-1.5 text-green-600 hover:text-green-800 hover:bg-green-50 transition-colors" title="Save"><Check className="w-4 h-4" /></button>
                        <button onClick={cancelEdit} className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors" title="Cancel"><X className="w-4 h-4" /></button>
                      </div>
                    </>
                  ) : undefined
                }
              />
            ))}
          </SortableContext>
        </DndContext>

        {categories.length === 0 && !showCreate && (
          <div className="px-4 py-8 text-center text-gray-500 text-sm">No categories yet. Create your first one.</div>
        )}

        {showCreate && (
          <div className="grid grid-cols-12 gap-4 px-4 py-3 border-b border-gray-200 items-center bg-green-50">
            <div className="col-span-1"></div>
            <div className="col-span-3">
              <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Category name" className="w-full px-2 py-1.5 text-sm border border-gray-300 focus:outline-none focus:ring-1 focus:ring-gray-900" autoFocus />
            </div>
            <div className="col-span-2 text-sm text-gray-400 italic px-2">auto-generated</div>
            <div className="col-span-4">
              <input type="text" value={newDescription} onChange={(e) => setNewDescription(e.target.value)} placeholder="Description (optional)" className="w-full px-2 py-1.5 text-sm border border-gray-300 focus:outline-none focus:ring-1 focus:ring-gray-900" />
            </div>
            <div className="col-span-2 flex justify-end gap-1">
              <button onClick={handleCreate} disabled={saving || !newName.trim()} className="p-1.5 text-green-600 hover:text-green-800 hover:bg-green-50 transition-colors disabled:opacity-50" title="Create"><Check className="w-4 h-4" /></button>
              <button onClick={() => { setShowCreate(false); setNewName(''); setNewDescription(''); setError(''); }} className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors" title="Cancel"><X className="w-4 h-4" /></button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
