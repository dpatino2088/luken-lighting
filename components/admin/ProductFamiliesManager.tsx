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
  createProduct,
  updateProduct,
  deleteProduct,
  updateProductSortOrder,
} from '@/app/(admin)/admin/products/actions';
import Link from 'next/link';
import { confirmDialog } from '@/components/ui/ConfirmDialog';
import { toast } from '@/components/ui/Toast';
import type { Product, ProductCategory } from '@/lib/types';

interface Props {
  initialProducts: Product[];
  categories: ProductCategory[];
}

function SortableRow({
  product,
  isEditing,
  onStartEdit,
  onDelete,
  editState,
  categoryName,
}: {
  product: Product;
  isEditing: boolean;
  onStartEdit: () => void;
  onDelete: () => void;
  editState?: React.ReactNode;
  categoryName: string;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: product.id });

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
    <div ref={setNodeRef} style={style} className="grid grid-cols-12 gap-4 px-4 py-3 border-b border-gray-200 items-center hover:bg-gray-50 transition-colors">
      <div className="col-span-1 flex justify-center">
        <button {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing p-1 text-gray-400 hover:text-gray-600 touch-none">
          <GripVertical className="w-4 h-4" />
        </button>
      </div>
      <div className="col-span-3 text-sm font-medium">{product.name}</div>
      <div className="col-span-2 text-sm text-gray-500">{categoryName || '—'}</div>
      <div className="col-span-4 text-sm text-gray-500 truncate">{product.description || '—'}</div>
      <div className="col-span-2 flex justify-end gap-1">
        <Link href={`/admin/products/${product.id}`} className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors" title="Edit">
          <Pencil className="w-4 h-4" />
        </Link>
        <button onClick={onDelete} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors" title="Delete">
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

export function ProductFamiliesManager({ initialProducts, categories }: Props) {
  const [products, setProducts] = useState(initialProducts);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const [editName, setEditName] = useState('');
  const [editSlug, setEditSlug] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editCategoryId, setEditCategoryId] = useState('');

  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newCategoryId, setNewCategoryId] = useState('');

  const catMap = new Map(categories.map((c) => [c.id, c.name]));

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const startEdit = (prod: Product) => {
    setEditingId(prod.id);
    setEditName(prod.name);
    setEditSlug(prod.slug);
    setEditDescription(prod.description || '');
    setEditCategoryId(prod.category_id || '');
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
    fd.set('category_id', editCategoryId);
    const result = await updateProduct(editingId, fd);
    if (result.error) { setError(result.error); }
    else {
      setProducts((prev) =>
        prev.map((p) => p.id === editingId
          ? { ...p, name: editName.trim(), slug: editSlug.trim(), description: editDescription.trim(), category_id: editCategoryId || null }
          : p
        )
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
    fd.set('category_id', newCategoryId);
    const result = await createProduct(fd);
    if (result.error) { setError(result.error); }
    else if (result.product) {
      setProducts((prev) => [...prev, result.product as Product]);
      setNewName(''); setNewDescription(''); setNewCategoryId(''); setShowCreate(false);
    }
    setSaving(false);
  };

  const handleDelete = async (prod: Product) => {
    const ok = await confirmDialog({
      title: 'Delete product',
      message: `Delete product "${prod.name}"? This cannot be undone.`,
      confirmLabel: 'Delete',
      destructive: true,
    });
    if (!ok) return;
    const result = await deleteProduct(prod.id);
    if (result.error) {
      toast.error(result.error);
    } else {
      setProducts((prev) => prev.filter((p) => p.id !== prod.id));
      toast.success(`Product "${prod.name}" deleted.`);
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = products.findIndex((p) => p.id === active.id);
    const newIndex = products.findIndex((p) => p.id === over.id);
    const reordered = arrayMove(products, oldIndex, newIndex);
    setProducts(reordered);
    await updateProductSortOrder(reordered.map((p) => p.id));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-light tracking-widest uppercase mb-2">Products</h1>
          <p className="text-gray-600">Manage products</p>
        </div>
        {!showCreate && (
          <Button type="button" variant="primary" onClick={() => { setShowCreate(true); setEditingId(null); setError(''); }}>
            <Plus className="w-4 h-4 mr-2" />
            Add Product
          </Button>
        )}
      </div>

      {error && <div className="p-3 bg-red-50 border border-red-200 text-red-800 text-sm">{error}</div>}

      <div className="border border-gray-200 bg-white">
        <div className="grid grid-cols-12 gap-4 px-4 py-3 bg-gray-50 border-b border-gray-200 text-xs font-medium text-gray-500 uppercase tracking-wide">
          <div className="col-span-1"></div>
          <div className="col-span-3">Name</div>
          <div className="col-span-2">Category</div>
          <div className="col-span-4">Description</div>
          <div className="col-span-2 text-right">Actions</div>
        </div>

        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={products.map((p) => p.id)} strategy={verticalListSortingStrategy}>
            {products.map((prod) => (
              <SortableRow
                key={prod.id}
                product={prod}
                categoryName={prod.category_id ? catMap.get(prod.category_id) || '' : ''}
                isEditing={editingId === prod.id}
                onStartEdit={() => startEdit(prod)}
                onDelete={() => handleDelete(prod)}
                editState={
                  editingId === prod.id ? (
                    <>
                      <div className="col-span-3">
                        <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)} className="w-full px-2 py-1.5 text-sm border border-gray-300 focus:outline-none focus:ring-1 focus:ring-gray-900" />
                      </div>
                      <div className="col-span-2">
                        <select value={editCategoryId} onChange={(e) => setEditCategoryId(e.target.value)} className="w-full px-2 py-1.5 text-sm border border-gray-300 focus:outline-none focus:ring-1 focus:ring-gray-900 bg-white">
                          <option value="">No category</option>
                          {categories.map((cat) => (
                            <option key={cat.id} value={cat.id}>{cat.name}</option>
                          ))}
                        </select>
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

        {products.length === 0 && !showCreate && (
          <div className="px-4 py-8 text-center text-gray-500 text-sm">No products yet. Create your first one.</div>
        )}

        {showCreate && (
          <div className="grid grid-cols-12 gap-4 px-4 py-3 border-b border-gray-200 items-center bg-green-50">
            <div className="col-span-1"></div>
            <div className="col-span-3">
              <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Product name" className="w-full px-2 py-1.5 text-sm border border-gray-300 focus:outline-none focus:ring-1 focus:ring-gray-900" autoFocus />
            </div>
            <div className="col-span-2">
              <select value={newCategoryId} onChange={(e) => setNewCategoryId(e.target.value)} className="w-full px-2 py-1.5 text-sm border border-gray-300 focus:outline-none focus:ring-1 focus:ring-gray-900 bg-white">
                <option value="">No category</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
            </div>
            <div className="col-span-4">
              <input type="text" value={newDescription} onChange={(e) => setNewDescription(e.target.value)} placeholder="Description" className="w-full px-2 py-1.5 text-sm border border-gray-300 focus:outline-none focus:ring-1 focus:ring-gray-900" />
            </div>
            <div className="col-span-2 flex justify-end gap-1">
              <button onClick={handleCreate} disabled={saving || !newName.trim()} className="p-1.5 text-green-600 hover:text-green-800 hover:bg-green-50 transition-colors disabled:opacity-50" title="Create"><Check className="w-4 h-4" /></button>
              <button onClick={() => { setShowCreate(false); setNewName(''); setNewDescription(''); setNewCategoryId(''); setError(''); }} className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors" title="Cancel"><X className="w-4 h-4" /></button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
