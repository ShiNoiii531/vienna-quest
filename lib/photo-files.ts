export const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
export const MAX_ORIGINAL_BYTES = 30 * 1024 * 1024;
export const MAX_PHOTO_EDGE = 2000;
export const validPhotoId = (id: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
export const photoInfo = (mission: string, photo: { id: string; uploaded_at: string; original_key?: string | null; original_name?: string | null }) => {
  const url = `/api/photos?mission=${encodeURIComponent(mission)}&v=${encodeURIComponent(photo.id)}`;
  return { id: photo.id, url, uploadedAt: photo.uploaded_at, originalUrl: photo.original_key ? `${url}&original=1` : null, originalName: photo.original_key ? photo.original_name : null };
};

// Check the format and declared frame size before storing client-normalized JPEG bytes.
export function validJpeg(bytes: Uint8Array, maxEdge = MAX_PHOTO_EDGE): boolean {
  if (bytes.length < 100 || bytes[0] !== 255 || bytes[1] !== 216 || bytes.at(-2) !== 255 || bytes.at(-1) !== 217) return false;
  let position = 2, frame = false;
  while (position + 3 < bytes.length) {
    if (bytes[position++] !== 255) return false;
    while (bytes[position] === 255) position++;
    const marker = bytes[position++];
    if (marker === 218) return frame;
    if (marker === 217) return false;
    if (marker === 1 || (marker >= 208 && marker <= 215)) continue;
    const length = bytes[position] * 256 + bytes[position + 1];
    if (length < 2 || position + length > bytes.length) return false;
    if ([192, 193, 194].includes(marker)) {
      if (length < 8) return false;
      const height = bytes[position + 3] * 256 + bytes[position + 4];
      const width = bytes[position + 5] * 256 + bytes[position + 6];
      if (!width || !height || width > maxEdge || height > maxEdge) return false;
      frame = true;
    }
    position += length;
  }
  return false;
}

export async function readPhotoBody(request: Request, maxBytes = MAX_PHOTO_BYTES): Promise<Uint8Array<ArrayBuffer>> {
  if (Number(request.headers.get('content-length')) > maxBytes) throw new RangeError('Photo trop volumineuse.');
  const reader = request.body?.getReader(); if (!reader) throw new Error('Photo absente.');
  const chunks: Uint8Array[] = []; let length = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read(); if (done) break;
      length += value.length;
      if (length > maxBytes) { await reader.cancel(); throw new RangeError('Photo trop volumineuse.'); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(length); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  return bytes;
}

// Originals are kept byte-for-byte, never decoded or re-encoded on the server.
// Only a private attachment download exposes them; the game displays the normalized JPEG.
export function originalFormat(bytes: Uint8Array): { type: string; extension: string } | null {
  if (validJpeg(bytes, 65535)) return { type: 'image/jpeg', extension: 'jpg' };
  if (bytes.length >= 24 && [137,80,78,71,13,10,26,10].every((v,i) => bytes[i] === v) && textAt(bytes,12,4) === 'IHDR') return { type: 'image/png', extension: 'png' };
  if (bytes.length >= 16 && textAt(bytes,0,4) === 'RIFF' && textAt(bytes,8,4) === 'WEBP') return { type: 'image/webp', extension: 'webp' };
  if (bytes.length >= 20 && textAt(bytes,4,4) === 'ftyp') {
    const size = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(0);
    if (size < 20 || size > bytes.length || size > 4096 || size % 4) return null;
    const brands = [textAt(bytes,8,4)];
    for (let offset = 16; offset < size; offset += 4) brands.push(textAt(bytes,offset,4));
    if (brands.some(b => ['avif','avis'].includes(b))) return { type: 'image/avif', extension: 'avif' };
    if (brands.some(b => ['heic','heix','hevc','hevx'].includes(b))) return { type: 'image/heic', extension: 'heic' };
    if (brands.some(b => ['mif1','msf1'].includes(b))) return { type: 'image/heif', extension: 'heif' };
  }
  return null;
}
function textAt(bytes: Uint8Array, offset: number, length: number) { return String.fromCharCode(...bytes.subarray(offset, offset + length)); }

export class PhotoUploadError extends Error {
  constructor(message: string, public status: number) { super(message); }
}
export type OriginalPhoto = { bytes: Uint8Array<ArrayBuffer>; type: string; extension: string; name: string; lastModified: number | null };
export async function readPhotoUpload(request: Request): Promise<{ bytes: Uint8Array<ArrayBuffer>; original: OriginalPhoto | null; comment?:string }> {
  // Existing open tabs may still send a preview alone. Do not label it as an original.
  if (request.headers.get('content-type')?.split(';')[0] === 'image/jpeg') return { bytes: await readPhotoBody(request), original: null };
  const maxBytes = MAX_PHOTO_BYTES + MAX_ORIGINAL_BYTES + 64 * 1024;
  if (Number(request.headers.get('content-length')) > maxBytes) throw new RangeError('Photo trop volumineuse.');
  const reader = request.body?.getReader();
  if (!reader) throw new PhotoUploadError('Photo absente.', 400);
  let length = 0;
  // Bound the multipart stream without making an extra full-size copy of the original.
  const body = new ReadableStream<Uint8Array>({
    async pull(controller) {
      const { done, value } = await reader.read();
      if (done) { reader.releaseLock(); controller.close(); return; }
      length += value.length;
      if (length > maxBytes) { await reader.cancel(); reader.releaseLock(); controller.error(new RangeError('Photo trop volumineuse.')); return; }
      controller.enqueue(value);
    },
    async cancel(reason) { await reader.cancel(reason); reader.releaseLock(); }
  });
  let form: FormData;
  try { form = await new Response(body, { headers: { 'Content-Type': request.headers.get('content-type') || '' } }).formData(); }
  catch (error) { if (error instanceof RangeError) throw error; throw new PhotoUploadError('L’envoi de la photo est incomplet. Réessayez.', 400); }
  const preview = form.get('preview'), original = form.get('original');
  if (!(preview instanceof File) || !(original instanceof File) || !original.size) throw new PhotoUploadError('La photo originale et son aperçu sont nécessaires. Choisissez-la de nouveau.', 400);
  if (preview.size > MAX_PHOTO_BYTES || original.size > MAX_ORIGINAL_BYTES) throw new RangeError('Photo trop volumineuse.');
  const bytes = new Uint8Array(await preview.arrayBuffer());
  const originalBytes = new Uint8Array(await original.arrayBuffer());
  const format = originalFormat(originalBytes);
  if (!format) throw new PhotoUploadError('Choisissez une photo JPEG, PNG, WebP, HEIC ou AVIF.', 415);
  const modified = form.get('lastModified');
  const lastModified = typeof modified === 'string' && /^\d{1,16}$/.test(modified) && Number.isSafeInteger(Number(modified)) ? Number(modified) : null;
  const name = original.name.replace(/[\x00-\x1f\x7f/\\]/g, '_').slice(0,255) || `photo.${format.extension}`;
  const comment=form.get('comment');
  return { bytes, original: { bytes: originalBytes, ...format, name, lastModified }, comment:typeof comment==='string'?comment:undefined };
}
