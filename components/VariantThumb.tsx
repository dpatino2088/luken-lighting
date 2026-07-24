'use client';

import { useState } from 'react';
import { Lightbulb } from 'lucide-react';
import type { ProductVariant } from '@/lib/types';
import { getLatestAssetUrl } from '@/lib/assets';

/** Latest primary image for a variant → used as the row thumbnail. */
function thumbUrl(v: ProductVariant): string | null {
  return getLatestAssetUrl(v.assets, 'image', { cacheBust: true });
}

/**
 * Table/card thumbnail. Uses a plain <img> (not next/image) so Supabase WebP
 * uploads never break via the optimizer, and falls back to a placeholder if
 * the file 404s or fails to decode.
 */
export function VariantThumb({
  v,
  className = 'h-11 w-11',
}: {
  v: ProductVariant;
  className?: string;
}) {
  const url = thumbUrl(v);
  const [failed, setFailed] = useState(false);
  const showImg = Boolean(url) && !failed;

  return (
    <div className={`relative shrink-0 overflow-hidden bg-gray-100 ${className}`}>
      {showImg ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url!}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
          loading="lazy"
          decoding="async"
          onError={() => setFailed(true)}
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center">
          <Lightbulb className="h-4 w-4 text-gray-300" />
        </div>
      )}
    </div>
  );
}
