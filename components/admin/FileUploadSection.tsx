'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Upload, FileText, Image as ImageIcon, FileSpreadsheet, Box, Trash2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { createClient } from '@/lib/supabase/client';
import { compressImage } from '@/lib/utils/compressImage';
import { checkImageSize } from '@/lib/utils/fileSize';
import { saveVariantAsset, deleteVariantAsset } from '@/app/(admin)/admin/variants/actions';
import { assetDownloadHref, getLatestAsset } from '@/lib/assets';
import { confirmDialog } from '@/components/ui/ConfirmDialog';
import { toast } from '@/components/ui/Toast';
import type { ProductAsset } from '@/lib/types';

const IMAGE_BUCKET_TYPES = new Set(['image', 'installed_image', 'dimensions_image', 'photometric_image']);

const ASSET_TYPES = [
  { value: 'image', label: 'Product Image', icon: ImageIcon, bucket: 'product-images', accept: 'image/*' },
  { value: 'installed_image', label: 'Product Installed Image', icon: ImageIcon, bucket: 'product-images', accept: 'image/*' },
  { value: 'dimensions_image', label: 'Product Dimensions Image', icon: ImageIcon, bucket: 'product-images', accept: 'image/*' },
  { value: 'photometric_image', label: 'Photometric Curve Image', icon: ImageIcon, bucket: 'product-images', accept: 'image/*' },
  { value: 'datasheet', label: 'Spec Sheet / Datasheet (PDF)', icon: FileText, bucket: 'documents', accept: '.pdf' },
  { value: 'photometric', label: 'IES Photometric File', icon: FileSpreadsheet, bucket: 'documents', accept: '.ies,.ldt' },
  { value: 'manual', label: 'Installation Manual', icon: FileText, bucket: 'documents', accept: '.pdf' },
  { value: 'line_drawing', label: 'Line Drawing (DWG/DXF)', icon: FileText, bucket: 'documents', accept: '.dwg,.dxf,.pdf,.svg' },
  { value: 'revit', label: 'Revit / BIM File', icon: Box, bucket: 'documents', accept: '.rfa,.rvt,.ifc' },
  { value: '3d', label: '3D Model (STEP/OBJ)', icon: Box, bucket: 'documents', accept: '.step,.stp,.obj,.fbx,.3ds' },
  { value: 'other', label: 'Other Document', icon: FileText, bucket: 'documents', accept: '*' },
] as const;

interface Props {
  productId: string;
  assets: ProductAsset[];
  /** Regenerate the datasheet from the Preview. Only offered on the PDF slot. */
  onUpdateDatasheet?: () => void;
  datasheetBusy?: boolean;
  /** Sheet content changed since the stored PDF was generated. */
  datasheetOutdated?: boolean;
}

export function FileUploadSection({
  productId,
  assets: initialAssets,
  onUpdateDatasheet,
  datasheetBusy = false,
  datasheetOutdated = false,
}: Props) {
  const router = useRouter();
  const [assets, setAssets] = useState<ProductAsset[]>(initialAssets);
  const [uploading, setUploading] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedType, setSelectedType] = useState('');

  useEffect(() => {
    setAssets(initialAssets);
  }, [initialAssets]);

  const handleUpload = async (assetType: string, file: File) => {
    const isImage = IMAGE_BUCKET_TYPES.has(assetType);
    // Size guard applies to images only; documents (Revit/3D/etc.) may be large.
    if (isImage) {
      const sizeError = checkImageSize(file);
      if (sizeError) {
        toast.error(sizeError);
        return;
      }
    }
    setUploading(assetType);

    try {
      const supabase = createClient();
      if (!supabase) throw new Error('Supabase not configured');
      const typeInfo = ASSET_TYPES.find((t) => t.value === assetType);
      const bucket = typeInfo?.bucket || 'documents';
      // Only raster product images benefit from resize/re-encode; PDFs, IES,
      // Revit and other documents must be uploaded untouched.
      const uploadFile = isImage
        ? await compressImage(file, { maxDimension: 2400, quality: 0.85 })
        : file;
      const ext = uploadFile.name.split('.').pop()?.toLowerCase() || '';
      const timestamp = Date.now();
      const filePath = `${productId}/${assetType}-${timestamp}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(filePath, uploadFile, {
          upsert: true,
          cacheControl: '31536000',
          contentType: uploadFile.type || undefined,
        });

      if (uploadError) {
        toast.error(`Upload failed: ${uploadError.message}`);
        setUploading(null);
        return;
      }

      const { data: urlData } = supabase.storage
        .from(bucket)
        .getPublicUrl(filePath);

      const title = typeInfo ? `${typeInfo.label} - ${file.name}` : file.name;
      const result = await saveVariantAsset(productId, assetType, title, urlData.publicUrl, ext);

      if (result.error) {
        toast.error(result.error);
      } else if (result.asset) {
        // Singleton slots (image / datasheet / …) replace previous rows server-side.
        const singleton = new Set(['image', 'photometric_image', 'dimensions_image', 'datasheet']);
        setAssets((prev) =>
          singleton.has(assetType)
            ? [...prev.filter((a) => a.type !== assetType), result.asset as ProductAsset]
            : [...prev, result.asset as ProductAsset]
        );
        toast.success('File uploaded.');
        // Refresh server data so the Preview tab picks up the new asset.
        router.refresh();
      }
    } catch (err: any) {
      toast.error(err.message || 'Upload failed');
    }
    setUploading(null);
  };

  const handleDelete = async (asset: ProductAsset) => {
    const ok = await confirmDialog({
      title: 'Delete file',
      message: `Delete "${asset.title}"?`,
      confirmLabel: 'Delete',
      destructive: true,
    });
    if (!ok) return;

    try {
      const supabase = createClient();
      if (!supabase) throw new Error('Supabase not configured');
      const isImageBucket = IMAGE_BUCKET_TYPES.has(asset.type);
      const bucket = isImageBucket ? 'product-images' : 'documents';

      if (asset.file_url && asset.file_url.includes('/storage/v1/object/public/')) {
        const pathParts = asset.file_url.split(`/storage/v1/object/public/${bucket}/`);
        const raw = pathParts[1]?.split('?')[0]?.split('#')[0];
        if (raw) {
          await supabase.storage.from(bucket).remove([decodeURIComponent(raw)]);
        }
      }

      const result = await deleteVariantAsset(asset.id, productId);
      if (result.error) {
        toast.error(result.error);
      } else {
        setAssets((prev) => prev.filter((a) => a.id !== asset.id));
        toast.success(`"${asset.title}" deleted.`);
        // Refresh server data so the Preview tab drops the removed asset.
        router.refresh();
      }
    } catch (err: any) {
      toast.error(err.message || 'Delete failed');
    }
  };

  const triggerFileSelect = (type: string) => {
    setSelectedType(type);
    const typeInfo = ASSET_TYPES.find((t) => t.value === type);
    if (fileInputRef.current && typeInfo) {
      fileInputRef.current.accept = typeInfo.accept;
      fileInputRef.current.click();
    }
  };

  const onFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && selectedType) {
      handleUpload(selectedType, file);
    }
    e.target.value = '';
  };

  const groupedAssets = ASSET_TYPES.map((type) => {
    const files = assets.filter((a) => a.type === type.value);
    // Datasheet is a singleton — Update PDF replaces the slot; never list leftovers.
    if (type.value === 'datasheet') {
      const latest = getLatestAsset(files, 'datasheet');
      return { ...type, files: latest ? [latest as ProductAsset] : [] };
    }
    return { ...type, files };
  });

  return (
    <div className="space-y-6">
      <input
        type="file"
        ref={fileInputRef}
        className="hidden"
        onChange={onFileSelected}
      />

      <div className="space-y-4">
        {groupedAssets.map((group) => {
          const Icon = group.icon;
          return (
            <div key={group.value} className="border border-gray-200 p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2 min-w-0">
                  <Icon className="w-4 h-4 text-gray-500 shrink-0" />
                  <span className="text-sm font-medium">{group.label}</span>
                  <span className="text-xs text-gray-400">({group.files.length})</span>
                  {group.value === 'datasheet' && (
                    <span
                      className={
                        'text-[10px] uppercase tracking-wide truncate ' +
                        (datasheetOutdated ? 'text-amber-600' : 'text-gray-400')
                      }
                    >
                      {datasheetOutdated ? 'Out of date · sheet changed' : 'Generated from Preview'}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {group.value === 'datasheet' && onUpdateDatasheet && (
                    <Button
                      type="button"
                      variant={datasheetOutdated ? 'primary' : 'secondary'}
                      size="sm"
                      disabled={datasheetBusy || uploading === group.value}
                      onClick={onUpdateDatasheet}
                    >
                      <RefreshCw
                        className={'w-3 h-3 mr-1' + (datasheetBusy ? ' animate-spin' : '')}
                      />
                      {datasheetBusy ? 'Updating…' : 'Update PDF'}
                    </Button>
                  )}
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    disabled={uploading === group.value}
                    onClick={() => triggerFileSelect(group.value)}
                  >
                    {uploading === group.value ? (
                      'Uploading...'
                    ) : (
                      <>
                        <Upload className="w-3 h-3 mr-1" />
                        {group.value === 'datasheet' ? 'Replace' : 'Upload'}
                      </>
                    )}
                  </Button>
                </div>
              </div>

              {group.files.length > 0 && (
                <div className="space-y-2">
                  {group.files.map((asset) => (
                    <div
                      key={asset.id}
                      className="flex items-center justify-between bg-gray-50 px-3 py-2 text-sm"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        {IMAGE_BUCKET_TYPES.has(asset.type) && asset.file_url ? (
                          <img
                            src={asset.file_url}
                            alt={asset.title}
                            className="w-10 h-10 object-cover border border-gray-200"
                          />
                        ) : (
                          <FileText className="w-4 h-4 text-gray-400 shrink-0" />
                        )}
                        <a
                          href={assetDownloadHref(asset)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline truncate"
                        >
                          {asset.title}
                        </a>
                        <span className="text-gray-400 uppercase text-xs shrink-0">
                          .{asset.file_extension}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDelete(asset)}
                        className="text-red-500 hover:text-red-700 p-1 shrink-0"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
