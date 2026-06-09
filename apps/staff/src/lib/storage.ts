import { uuid } from './db';
import { supabase } from './supabase/client';

const BUCKET = 'photos';

// Uploads to Supabase Storage when configured. Returns the stored path, or null
// when storage is unavailable (the local verification path).
export async function uploadPhoto(file: File): Promise<string | null> {
  if (!supabase) {
    return null;
  }
  const extension = file.name.split('.').pop() ?? 'jpg';
  const path = `${uuid()}.${extension}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file);
  if (error) {
    throw error;
  }
  return path;
}

export function photoUrl(path: string | null): string | null {
  if (!path || !supabase) {
    return null;
  }
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}
