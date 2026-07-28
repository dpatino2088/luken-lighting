/**
 * Shared helpers for product_assets selection.
 * Multiple rows of the same type can exist after re-uploads; UI that needs
 * "the" image must prefer the most recently created asset — never assets[0]
 * in insertion / sort_order order alone.
 */

export type AssetLike = {
  id?: string;
  type: string;
  file_url: string | null;
  created_at?: string | null;
  sort_order?: number | null;
};

/** Latest asset of `type` with a file_url, or null. */
export function getLatestAsset<T extends AssetLike>(
  assets: T[] | null | undefined,
  type: string,
): T | null {
  const matches = (assets || []).filter((a) => a.type === type && a.file_url);
  if (matches.length === 0) return null;
  return matches.reduce((newest, a) => {
    const aT = a.created_at ? new Date(a.created_at).getTime() : 0;
    const nT = newest.created_at ? new Date(newest.created_at).getTime() : 0;
    if (aT !== nT) return aT >= nT ? a : newest;
    // Tie-break: higher sort_order, then id (newer uuid-ish inserts last).
    const aS = a.sort_order ?? 0;
    const nS = newest.sort_order ?? 0;
    if (aS !== nS) return aS >= nS ? a : newest;
    return (a.id || '') >= (newest.id || '') ? a : newest;
  });
}

/** Latest file_url for `type`, optionally cache-busted with created_at + id. */
export function getLatestAssetUrl(
  assets: AssetLike[] | null | undefined,
  type: string,
  opts?: { cacheBust?: boolean },
): string | null {
  const latest = getLatestAsset(assets, type);
  if (!latest?.file_url) return null;
  if (!opts?.cacheBust) return latest.file_url;
  const stamp =
    (latest.created_at ? new Date(latest.created_at).getTime() : 0) ||
    latest.id ||
    String(Date.now());
  const sep = latest.file_url.includes('?') ? '&' : '?';
  // Use `t=` so it stacks with any `?v=` already stored on the URL.
  return `${latest.file_url}${sep}t=${encodeURIComponent(String(stamp))}`;
}

/** Public download href — always cache-busted for singleton docs like datasheet. */
export function assetDownloadHref(asset: AssetLike | null | undefined): string {
  if (!asset?.file_url) return '#';
  const stamp =
    (asset.created_at ? new Date(asset.created_at).getTime() : 0) ||
    asset.id ||
    String(Date.now());
  const sep = asset.file_url.includes('?') ? '&' : '?';
  return `${asset.file_url}${sep}t=${encodeURIComponent(String(stamp))}`;
}

/** Sort assets of a type newest-first (for galleries that lead with the current primary). */
export function sortAssetsNewestFirst<T extends AssetLike>(assets: T[]): T[] {
  return [...assets].sort((a, b) => {
    const aT = a.created_at ? new Date(a.created_at).getTime() : 0;
    const bT = b.created_at ? new Date(b.created_at).getTime() : 0;
    if (bT !== aT) return bT - aT;
    return (b.sort_order ?? 0) - (a.sort_order ?? 0);
  });
}
