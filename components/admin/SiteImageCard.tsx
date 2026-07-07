'use client';

import { useState, useRef } from 'react';
import { Upload, Trash2, Save } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { createClient } from '@/lib/supabase/client';
import { compressImage } from '@/lib/utils/compressImage';
import { checkImageSize } from '@/lib/utils/fileSize';
import {
  updateSiteImage,
  updateSiteImageAltText,
  deleteSiteImage,
} from '@/app/(admin)/admin/images/actions';
import { confirmDialog } from '@/components/ui/ConfirmDialog';
import { toast } from '@/components/ui/Toast';
import type { SiteImage } from '@/lib/types';

const STORAGE_BUCKET = 'site-images';

interface Props {
  image: SiteImage;
}

export function SiteImageCard({ image: initialImage }: Props) {
  const [image, setImage] = useState(initialImage);
  const [altText, setAltText] = useState(initialImage.alt_text || '');
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const altTextChanged = altText !== (image.alt_text || '');

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

      const uploadFile = await compressImage(file, { maxDimension: 2400, quality: 0.85 });
      const ext = uploadFile.name.split('.').pop()?.toLowerCase() || 'jpg';
      const filePath = `site/${image.key}-${Date.now()}.${ext}`;

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

      const result = await updateSiteImage(
        image.key,
        urlData.publicUrl,
        altText || file.name
      );

      if (result.error) {
        toast.error(result.error);
      } else {
        setImage((prev) => ({
          ...prev,
          image_url: urlData.publicUrl,
          alt_text: altText || file.name,
        }));
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
      message: `Remove image for "${image.label}"?`,
      confirmLabel: 'Remove',
      destructive: true,
    });
    if (!ok) return;

    try {
      const result = await deleteSiteImage(image.key);
      if (result.error) {
        toast.error(result.error);
      } else {
        setImage((prev) => ({ ...prev, image_url: null, alt_text: null }));
        setAltText('');
        toast.success('Image removed.');
      }
    } catch (err: any) {
      toast.error(err.message || 'Delete failed');
    }
  };

  const handleSaveAltText = async () => {
    setSaving(true);
    try {
      const result = await updateSiteImageAltText(image.key, altText);
      if (result.error) {
        toast.error(result.error);
      } else {
        setImage((prev) => ({ ...prev, alt_text: altText }));
        toast.success('Alt text saved.');
      }
    } catch (err: any) {
      toast.error(err.message || 'Save failed');
    }
    setSaving(false);
  };

  const onFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleUpload(file);
    e.target.value = '';
  };

  return (
    <div className="border border-gray-200 bg-white">
      <input
        type="file"
        ref={fileInputRef}
        className="hidden"
        accept="image/*"
        onChange={onFileSelected}
      />

      {/* Image preview */}
      <div className="aspect-video bg-gray-100 relative overflow-hidden">
        {image.image_url ? (
          <img
            src={image.image_url}
            alt={image.alt_text || image.label}
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

      {/* Info + controls */}
      <div className="p-4 space-y-3">
        <div>
          <h3 className="text-sm font-medium">{image.label}</h3>
          {image.description && (
            <p className="text-xs text-gray-500 mt-0.5">{image.description}</p>
          )}
        </div>

        {/* Alt text */}
        <div>
          <label className="block text-xs text-gray-500 mb-1">Alt text</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={altText}
              onChange={(e) => setAltText(e.target.value)}
              placeholder="Describe this image..."
              className="flex-1 px-3 py-1.5 text-sm border border-gray-300 focus:outline-none focus:ring-1 focus:ring-gray-900 focus:border-gray-900"
            />
            {altTextChanged && image.image_url && (
              <button
                type="button"
                onClick={handleSaveAltText}
                disabled={saving}
                className="p-1.5 text-gray-600 hover:text-gray-900 border border-gray-300 hover:border-gray-900 transition-colors"
                title="Save alt text"
              >
                <Save className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Actions */}
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
                {image.image_url ? 'Replace' : 'Upload'}
              </>
            )}
          </Button>
          {image.image_url && (
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
