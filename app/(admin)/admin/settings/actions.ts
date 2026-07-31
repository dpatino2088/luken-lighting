'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import type { AppSettings } from '@/lib/types';

const SETTINGS_DEFAULTS: AppSettings = {
  eur_to_usd_rate: 1.2,
  brand_logo_url: null,
  label_logo_url: null,
  sheet_footer_note: 'www.lukenlighting.com',
};

export async function getSettings(): Promise<AppSettings> {
  const supabase = await createClient();
  if (!supabase) return SETTINGS_DEFAULTS;

  const { data, error } = await supabase
    .from('app_settings')
    .select('key, value')
    .in('key', ['eur_to_usd_rate', 'brand_logo_url', 'label_logo_url', 'sheet_footer_note']);

  if (error || !data) return SETTINGS_DEFAULTS;

  const map = Object.fromEntries(data.map((r) => [r.key, r.value]));

  return {
    eur_to_usd_rate: map.eur_to_usd_rate ? Number(map.eur_to_usd_rate) : SETTINGS_DEFAULTS.eur_to_usd_rate,
    brand_logo_url: map.brand_logo_url ? map.brand_logo_url : null,
    label_logo_url: map.label_logo_url ? map.label_logo_url : null,
    // Distinguish "never configured" from "deliberately blank": only a missing
    // row falls back to the default.
    sheet_footer_note:
      map.sheet_footer_note === undefined
        ? SETTINGS_DEFAULTS.sheet_footer_note
        : map.sheet_footer_note || null,
  };
}

export async function updateSettings(formData: FormData) {
  const supabase = await createClient();
  if (!supabase) return { error: 'Supabase not configured' };

  const rate = String(formData.get('eur_to_usd_rate') || '1.2');
  const brandLogoUrl = String(formData.get('brand_logo_url') || '');
  const labelLogoUrl = String(formData.get('label_logo_url') || '');
  const sheetFooterNote = String(formData.get('sheet_footer_note') || '').trim();

  const { error } = await supabase
    .from('app_settings')
    .upsert(
      [
        { key: 'eur_to_usd_rate', value: rate },
        { key: 'brand_logo_url', value: brandLogoUrl },
        { key: 'label_logo_url', value: labelLogoUrl },
        { key: 'sheet_footer_note', value: sheetFooterNote },
      ],
      { onConflict: 'key' },
    );

  if (error) return { error: error.message };

  revalidatePath('/admin/settings');
  revalidatePath('/admin/products');
  revalidatePath('/admin/variants');
  return { success: true };
}
