'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import type { Manufacturer } from '@/lib/types';

export async function listManufacturers(): Promise<{ manufacturers?: Manufacturer[]; error?: string }> {
  const supabase = await createClient();
  if (!supabase) return { error: 'Supabase not configured' };
  const { data, error } = await supabase
    .from('manufacturers')
    .select('*')
    .order('name');
  if (error) return { error: error.message };
  return { manufacturers: (data ?? []) as Manufacturer[] };
}

export async function createManufacturer(input: {
  name: string;
  country?: string | null;
  currency?: string | null;
}): Promise<{ manufacturer?: Manufacturer; error?: string }> {
  const supabase = await createClient();
  if (!supabase) return { error: 'Supabase not configured' };

  const name = input.name?.trim();
  if (!name) return { error: 'Name is required' };

  const { data, error } = await supabase
    .from('manufacturers')
    .insert({
      name,
      country: input.country?.trim() || null,
      currency: input.currency?.trim() || null,
    })
    .select()
    .single();

  if (error) {
    if (error.code === '23505') return { error: `A manufacturer named "${name}" already exists` };
    return { error: error.message };
  }

  revalidatePath('/admin/variants');
  return { manufacturer: data as Manufacturer };
}

export async function updateManufacturer(
  id: string,
  input: { name: string; country?: string | null; currency?: string | null },
): Promise<{ manufacturer?: Manufacturer; error?: string }> {
  const supabase = await createClient();
  if (!supabase) return { error: 'Supabase not configured' };

  const name = input.name?.trim();
  if (!name) return { error: 'Name is required' };

  // Grab the previous name so a rename can be propagated to variants that
  // stored the manufacturer as text.
  const { data: prev } = await supabase.from('manufacturers').select('name').eq('id', id).single();

  const { data, error } = await supabase
    .from('manufacturers')
    .update({
      name,
      country: input.country?.trim() || null,
      currency: input.currency?.trim() || null,
    })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    if (error.code === '23505') return { error: `A manufacturer named "${name}" already exists` };
    return { error: error.message };
  }

  if (prev?.name && prev.name !== name) {
    await supabase.from('product_variants').update({ manufacturer: name }).eq('manufacturer', prev.name);
    await supabase.from('products').update({ manufacturer: name }).eq('manufacturer', prev.name);
  }

  revalidatePath('/admin/variants');
  revalidatePath('/products');
  return { manufacturer: data as Manufacturer };
}

export async function deleteManufacturer(id: string): Promise<{ success?: boolean; error?: string }> {
  const supabase = await createClient();
  if (!supabase) return { error: 'Supabase not configured' };

  const { error } = await supabase.from('manufacturers').delete().eq('id', id);
  if (error) return { error: error.message };

  // Note: variants keep their stored manufacturer text; deleting only removes
  // the entry from the reusable dropdown.
  revalidatePath('/admin/variants');
  return { success: true };
}
