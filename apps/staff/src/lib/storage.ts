import { uuid } from './db';
import { supabase } from './supabase/client';

const BUCKET = 'photos';
const MAX_DIMENSION = 1280;

async function compressToDataUrl(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('canvas 2d context unavailable');
  }
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas.toDataURL('image/jpeg', 0.8);
}

// Stores a photo and returns the value kept in *_path columns: a Storage path
// when Supabase is configured, otherwise a compressed data URL held in the
// local DB so photos work offline and in the local verification path.
export async function storePhoto(file: File): Promise<string> {
  if (!supabase) {
    return compressToDataUrl(file);
  }
  const extension = file.name.split('.').pop() ?? 'jpg';
  const path = `${uuid()}.${extension}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file);
  if (error) {
    throw error;
  }
  return path;
}

export function photoSrc(value: string | null): string | null {
  if (!value) {
    return null;
  }
  if (value.startsWith('data:')) {
    return value;
  }
  if (!supabase) {
    return null;
  }
  return supabase.storage.from(BUCKET).getPublicUrl(value).data.publicUrl;
}
