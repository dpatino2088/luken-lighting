'use client';

import { useState, useRef } from 'react';
import Link from 'next/link';
import { ArrowLeft, Upload, Trash2, X, Plus, Search } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { EntityImageCard } from '@/components/admin/EntityImageCard';
import { createClient } from '@/lib/supabase/client';
import {
  updateProject,
  addProjectImage,
  deleteProjectImage,
  linkProduct,
  unlinkProduct,
} from '@/app/(admin)/admin/inspiration/actions';
import { confirmDialog } from '@/components/ui/ConfirmDialog';
import { toast } from '@/components/ui/Toast';
import type { InspirationProject, ProjectImage, Product } from '@/lib/types';

const STORAGE_BUCKET = 'site-images';

interface Props {
  project: InspirationProject;
  images: ProjectImage[];
  linkedProducts: Product[];
  allProducts: Pick<Product, 'id' | 'name' | 'slug'>[];
}

export function ProjectEditPage({
  project: initialProject,
  images: initialImages,
  linkedProducts: initialLinked,
  allProducts,
}: Props) {
  const [project, setProject] = useState(initialProject);
  const [images, setImages] = useState(initialImages);
  const [linked, setLinked] = useState(initialLinked);

  // --- Details form state ---
  const [name, setName] = useState(project.name);
  const [slug, setSlug] = useState(project.slug);
  const [description, setDescription] = useState(project.description || '');
  const [location, setLocation] = useState(project.location || '');
  const [year, setYear] = useState(project.year ? String(project.year) : '');
  const [architect, setArchitect] = useState(project.architect || '');
  const [lightingDesigner, setLightingDesigner] = useState(project.lighting_designer || '');
  const [clientName, setClientName] = useState(project.client_name || '');
  const [photographer, setPhotographer] = useState(project.photographer || '');

  const [saving, setSaving] = useState(false);

  // --- Gallery state ---
  const [uploading, setUploading] = useState(false);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  // --- Product linker state ---
  const [productSearch, setProductSearch] = useState('');
  const [showPicker, setShowPicker] = useState(false);
  const [linking, setLinking] = useState(false);

  // ========== Details handlers ==========

  const handleSaveDetails = async () => {
    if (!name.trim()) return;
    setSaving(true);

    const fd = new FormData();
    fd.set('name', name.trim());
    fd.set('slug', slug.trim());
    fd.set('description', description.trim());
    fd.set('location', location.trim());
    fd.set('year', year.trim());
    fd.set('architect', architect.trim());
    fd.set('lighting_designer', lightingDesigner.trim());
    fd.set('client_name', clientName.trim());
    fd.set('photographer', photographer.trim());

    const result = await updateProject(project.id, fd);
    if (result.error) {
      toast.error(result.error);
    } else {
      setProject((prev) => ({
        ...prev,
        name: name.trim(),
        slug: slug.trim(),
        description: description.trim() || null,
        location: location.trim() || null,
        year: year.trim() ? Number(year) : null,
        architect: architect.trim() || null,
        lighting_designer: lightingDesigner.trim() || null,
        client_name: clientName.trim() || null,
        photographer: photographer.trim() || null,
      }));
      toast.success('Project saved.');
    }
    setSaving(false);
  };

  // ========== Gallery handlers ==========

  const handleGalleryUpload = async (file: File) => {
    setUploading(true);

    try {
      const supabase = createClient();
      if (!supabase) {
        toast.error('Supabase not configured');
        setUploading(false);
        return;
      }

      const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
      // Unique per file: batch uploads fire within the same millisecond, so
      // Date.now() alone collides and (with upsert) every file overwrites the
      // same object → duplicated/single image. A random id guarantees uniqueness.
      const unique =
        (typeof crypto !== 'undefined' && crypto.randomUUID)
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const filePath = `inspiration/${project.id}/gallery-${unique}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from(STORAGE_BUCKET)
        .upload(filePath, file, { upsert: true });

      if (uploadError) {
        toast.error(`Upload failed: ${uploadError.message}`);
        setUploading(false);
        return;
      }

      const { data: urlData } = supabase.storage
        .from(STORAGE_BUCKET)
        .getPublicUrl(filePath);

      const result = await addProjectImage(project.id, urlData.publicUrl);
      if (result.error) {
        toast.error(result.error);
      } else if (result.image) {
        setImages((prev) => [...prev, result.image as ProjectImage]);
      }
    } catch (err: any) {
      toast.error(err.message || 'Upload failed');
    }
    setUploading(false);
  };

  const onGalleryFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    // Upload sequentially so every file completes and preserves selection order.
    for (const file of files) {
      await handleGalleryUpload(file);
    }
  };

  const handleDeleteImage = async (imageId: string) => {
    const ok = await confirmDialog({
      title: 'Delete image',
      message: 'Delete this image?',
      confirmLabel: 'Delete',
      destructive: true,
    });
    if (!ok) return;

    const result = await deleteProjectImage(imageId);
    if (result.error) {
      toast.error(result.error);
    } else {
      setImages((prev) => prev.filter((img) => img.id !== imageId));
    }
  };

  // ========== Product linking handlers ==========

  const linkedIds = new Set(linked.map((p) => p.id));

  const filteredProducts = allProducts.filter((p) => {
    if (linkedIds.has(p.id)) return false;
    if (!productSearch.trim()) return true;
    const q = productSearch.toLowerCase();
    return (
      p.name.toLowerCase().includes(q) ||
      p.slug.toLowerCase().includes(q)
    );
  });

  const handleLink = async (productId: string) => {
    setLinking(true);

    const result = await linkProduct(project.id, productId);
    if (result.error) {
      toast.error(result.error);
    } else {
      const product = allProducts.find((p) => p.id === productId);
      if (product) {
        setLinked((prev) => [...prev, product as Product]);
      }
    }
    setLinking(false);
  };

  const handleUnlink = async (productId: string) => {
    const result = await unlinkProduct(project.id, productId);
    if (result.error) {
      toast.error(result.error);
    } else {
      setLinked((prev) => prev.filter((p) => p.id !== productId));
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <Link
          href="/admin/inspiration"
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900 mb-4 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Projects
        </Link>
        <h1 className="text-3xl font-light tracking-widest uppercase">
          {project.name}
        </h1>
        <p className="text-sm text-gray-500 mt-1">{project.slug}</p>
      </div>

      {/* Section A: Project Details */}
      <section className="bg-white border border-gray-200 p-6 space-y-5">
        <h2 className="text-lg font-medium uppercase tracking-wide border-b border-gray-200 pb-3">
          Project Details
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} />
          <Input label="Slug" value={slug} onChange={(e) => setSlug(e.target.value)} />
          <Input label="Location" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g. Madrid, Spain" />
          <Input label="Year" type="number" value={year} onChange={(e) => setYear(e.target.value)} placeholder="e.g. 2024" />
          <Input label="Architect" value={architect} onChange={(e) => setArchitect(e.target.value)} />
          <Input label="Lighting Designer" value={lightingDesigner} onChange={(e) => setLightingDesigner(e.target.value)} />
          <Input label="Client" value={clientName} onChange={(e) => setClientName(e.target.value)} />
          <Input label="Photographer" value={photographer} onChange={(e) => setPhotographer(e.target.value)} />
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            className="w-full px-4 py-2.5 border border-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent text-gray-900"
          />
        </div>

        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="primary"
            disabled={saving || !name.trim()}
            onClick={handleSaveDetails}
          >
            {saving ? 'Saving...' : 'Save Details'}
          </Button>
        </div>
      </section>

      {/* Hero & Thumbnail */}
      <section className="bg-white border border-gray-200 p-6 space-y-5">
        <h2 className="text-lg font-medium uppercase tracking-wide border-b border-gray-200 pb-3">
          Cover Images
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <EntityImageCard
            table="inspiration_projects"
            field="hero_image_url"
            entityId={project.id}
            entityName={project.name}
            label="Hero Image"
            currentImageUrl={project.hero_image_url}
          />
          <EntityImageCard
            table="inspiration_projects"
            field="thumbnail_url"
            entityId={project.id}
            entityName={project.name}
            label="Thumbnail"
            currentImageUrl={project.thumbnail_url}
          />
        </div>
      </section>

      {/* Section B: Photo Gallery */}
      <section className="bg-white border border-gray-200 p-6 space-y-5">
        <div className="flex items-center justify-between border-b border-gray-200 pb-3">
          <h2 className="text-lg font-medium uppercase tracking-wide">
            Photo Gallery
          </h2>
          <input
            type="file"
            ref={galleryInputRef}
            className="hidden"
            accept="image/*"
            multiple
            onChange={onGalleryFileSelected}
          />
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={uploading}
            onClick={() => galleryInputRef.current?.click()}
          >
            {uploading ? (
              'Uploading...'
            ) : (
              <>
                <Upload className="w-3.5 h-3.5 mr-1.5" />
                Add Photos
              </>
            )}
          </Button>
        </div>

        {images.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {images.map((img) => (
              <div key={img.id} className="group relative">
                <div className="aspect-[4/3] bg-gray-100 overflow-hidden border border-gray-200">
                  <img
                    src={img.image_url}
                    alt={img.caption || 'Project photo'}
                    className="w-full h-full object-cover"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => handleDeleteImage(img.id)}
                  className="absolute top-2 right-2 p-1.5 bg-white/90 border border-gray-200 text-red-500 hover:text-red-700 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-all"
                  title="Delete image"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-12 text-center text-gray-400 border border-dashed border-gray-300">
            <Upload className="w-8 h-8 mx-auto mb-2" />
            <p className="text-sm">No gallery photos yet</p>
            <p className="text-xs mt-1">Upload images to build the project story</p>
          </div>
        )}
      </section>

      {/* Section C: Linked Products */}
      <section className="bg-white border border-gray-200 p-6 space-y-5">
        <h2 className="text-lg font-medium uppercase tracking-wide border-b border-gray-200 pb-3">
          Linked Products
        </h2>

        {/* Current linked products */}
        {linked.length > 0 ? (
          <div className="space-y-2">
            {linked.map((product) => (
              <div
                key={product.id}
                className="flex items-center justify-between p-3 border border-gray-200 bg-gray-50"
              >
                <div className="min-w-0">
                  <span className="text-sm font-medium">{product.name}</span>
                </div>
                <button
                  type="button"
                  onClick={() => handleUnlink(product.id)}
                  className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors flex-shrink-0"
                  title="Unlink product"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-400 py-4 text-center border border-dashed border-gray-300">
            No products linked to this project yet
          </p>
        )}

        {/* Product picker */}
        <div className="pt-2">
          {!showPicker ? (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setShowPicker(true)}
            >
              <Plus className="w-3.5 h-3.5 mr-1.5" />
              Link a Product
            </Button>
          ) : (
            <div className="border border-gray-200 bg-gray-50 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium">Select a product</h3>
                <button
                  type="button"
                  onClick={() => {
                    setShowPicker(false);
                    setProductSearch('');
                  }}
                  className="p-1 text-gray-400 hover:text-gray-700"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  placeholder="Search by name or code..."
                  className="w-full pl-9 pr-4 py-2 text-sm border border-gray-300 focus:outline-none focus:ring-1 focus:ring-gray-900"
                  autoFocus
                />
              </div>

              <div className="max-h-48 overflow-y-auto space-y-1">
                {filteredProducts.length > 0 ? (
                  filteredProducts.map((product) => (
                    <button
                      key={product.id}
                      type="button"
                      disabled={linking}
                      onClick={() => handleLink(product.id)}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-white border border-transparent hover:border-gray-200 transition-colors disabled:opacity-50"
                    >
                      <span className="font-medium">{product.name}</span>
                    </button>
                  ))
                ) : (
                  <p className="text-xs text-gray-400 text-center py-4">
                    {productSearch.trim()
                      ? 'No matching products found'
                      : 'All products are already linked'}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
