/**
 * Resource type detection and utility helpers
 */

export function isImageMime(mime, name = '') {
  if (mime && typeof mime === 'string' && mime.startsWith('image/')) return true;
  return /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(name || '');
}

export function isPdfMime(mime, name = '') {
  if (mime === 'application/pdf') return true;
  return /\.pdf$/i.test(name || '');
}

export function getResourceKind(mime, name = '') {
  if (isImageMime(mime, name)) return 'image';
  if (isPdfMime(mime, name)) return 'pdf';
  return 'other';
}
