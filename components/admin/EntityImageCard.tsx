'use client';

import { useState, useRef } from 'react';
import { Upload, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { createClient } from '@/lib/supabase/client';
import { compressImage } from '@/lib/utils/compressImage';
import { checkImageSize } from '@/lib/utils/fileSize';
import {
  updateEntityImage,
  deleteEntityImage,
} from '@/app/(admin)/admin/images/actions';
import { confirmDialog } from '@/components/ui/ConfirmDialog';
import { toast } from '@/components/ui/Toast';

const STORAGE_BUCKET = 'site-images';

interface Props {
  table: 'product_categories' | 'products' | 'inspiration_projects';
  field?: 'hero_image_url' | 'thumbnail_url';
  entityId: string;
  entityName: string;
  label?: string;
  currentImageUrl: string | null;
}

export function EntityImageCard({
  table,
  field = 'hero_image_url',
  entityId,
  entityName,
  label,
  currentImageUrl: initialUrl,
}: Props) {
  const [imageUrl, setImageUrl] = useState(initialUrl);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const folderPrefix =
    table === 'product_categories'
      ? 'categories'
      : table === 'products'
        ? 'products'
        : 'inspiration';

  const suffix = field === 'thumbnail_url' ? '-thumb' : '-hero';

  const handleUpload = async (file: File) => {
    const sizeError = checkImageSize(file);
    if (sizeError) {
      toast.error(sizeError);
      return;
    }
    setUploading(true);

    try {
      const supabase = createClient();
      if (!supabase) {
        toast.error('Supabase not configured');
        setUploading(false);
        return;
      }

      // Thumbnails are shown small (cards/lists), so they can be resized
      // more aggressively than hero images.
      const uploadFile = await compressImage(file, {
        maxDimension: field === 'thumbnail_url' ? 800 : 2400,
        quality: 0.85,
      });
      const ext = uploadFile.name.split('.').pop()?.toLowerCase() || 'jpg';
      const filePath = `${folderPrefix}/${entityId}${suffix}-${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from(STORAGE_BUCKET)
        .upload(filePath, uploadFile, { upsert: true, cacheControl: '31536000' });

      if (uploadError) {
        toast.error(`Upload failed: ${uploadError.message}`);
        setUploading(false);
        return;
      }

      const { data: urlData } = supabase.storage
        .from(STORAGE_BUCKET)
        .getPublicUrl(filePath);

      const result = await updateEntityImage(
        table,
        entityId,
        field,
        urlData.publicUrl
      );

      if (result.error) {
        toast.error(result.error);
      } else {
        setImageUrl(urlData.publicUrl);
        toast.success('Image uploaded.');
      }
    } catch (err: any) {
      toast.error(err.message || 'Upload failed');
    }
    setUploading(false);
  };

  const handleDelete = async () => {
    const ok = await confirmDialog({
      title: 'Remove image',
      message: `Remove image for "${entityName}"?`,
      confirmLabel: 'Remove',
      destructive: true,
    });
    if (!ok) return;

    try {
      const result = await deleteEntityImage(table, entityId, field);
      if (result.error) {
        toast.error(result.error);
      } else {
        setImageUrl(null);
        toast.success('Image removed.');
      }
    } catch (err: any) {
      toast.error(err.message || 'Delete failed');
    }
  };

  const onFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleUpload(file);
    e.target.value = '';
  };

  const displayLabel = label || entityName;

  return (
    <div className="border border-gray-200 bg-white">
      <input
        type="file"
        ref={fileInputRef}
        className="hidden"
        accept="image/*"
        onChange={onFileSelected}
      />

      <div className="aspect-video bg-gray-100 relative overflow-hidden">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={displayLabel}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-400">
            <div className="text-center">
              <Upload className="w-8 h-8 mx-auto mb-2" />
              <p className="text-sm">No image</p>
            </div>
          </div>
        )}
      </div>

      <div className="p-4 space-y-3">
        <h3 className="text-sm font-medium">{displayLabel}</h3>

        <div className="flex gap-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={uploading}
            onClick={() => fileInputRef.current?.click()}
            className="flex-1"
          >
            {uploading ? (
              'Uploading...'
            ) : (
              <>
                <Upload className="w-3 h-3 mr-1.5" />
                {imageUrl ? 'Replace' : 'Upload'}
              </>
            )}
          </Button>
          {imageUrl && (
            <button
              type="button"
              onClick={handleDelete}
              className="p-2 text-red-500 hover:text-red-700 border border-gray-200 hover:border-red-300 transition-colors"
              title="Remove image"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
